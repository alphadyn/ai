from __future__ import annotations

import ipaddress
import json
import random
import re
import socket
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser


MAX_URLS = 20
MAX_RESPONSE_BYTES = 2_000_000
RANDOM_DISCOVERY_API = "https://hn.algolia.com/api/v1/search_by_date"
RANDOM_URL_CANDIDATES = (
    "https://www.bbc.com/news",
    "https://www.cern.ch/",
    "https://www.debian.org/",
    "https://www.eff.org/",
    "https://www.gnu.org/",
    "https://www.iana.org/domains/reserved",
    "https://www.khanacademy.org/",
    "https://www.loc.gov/",
    "https://www.mozilla.org/",
    "https://www.nasa.gov/",
    "https://www.nationalgeographic.com/",
    "https://www.npr.org/",
    "https://www.openstreetmap.org/",
    "https://www.python.org/",
    "https://www.si.edu/",
    "https://www.space.com/",
    "https://www.un.org/",
    "https://www.w3.org/",
    "https://en.wikinews.org/",
    "https://en.wikipedia.org/wiki/Special:Random",
    "https://www.worldbank.org/",
    "https://www.ycombinator.com/",
)
DEFAULT_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "he", "in", "is", "it", "its", "of", "on", "or", "that",
    "the", "to", "was", "were", "will", "with", "you", "your",
}


class VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"} and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            cleaned = re.sub(r"\s+", " ", data).strip()
            if cleaned:
                self.parts.append(cleaned)

    def text(self) -> str:
        return " ".join(self.parts)


def validate_public_url(url: str) -> str:
    normalized = url.strip()
    parsed = urllib.parse.urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Enter a complete HTTP or HTTPS URL.")
    if parsed.username or parsed.password:
        raise ValueError("URLs containing credentials are not allowed.")

    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    except socket.gaierror as error:
        raise ValueError("The URL hostname could not be resolved.") from error

    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise ValueError("Private and local network addresses are not allowed.")
    return normalized


def extract_visible_text(html: str) -> str:
    parser = VisibleTextParser()
    parser.feed(html)
    parser.close()
    return parser.text()


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        validate_public_url(new_url)
        return super().redirect_request(request, file_pointer, code, message, headers, new_url)


def fetch_page(url: str) -> str:
    safe_url = validate_public_url(url)
    request = urllib.request.Request(
        safe_url,
        headers={
            "User-Agent": "WordScope/1.0 (+local research tool)",
            "Accept": "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8",
        },
    )
    opener = urllib.request.build_opener(SafeRedirectHandler())
    with opener.open(request, timeout=10) as response:
        validate_public_url(response.geturl())
        content_type = response.headers.get_content_type()
        if content_type not in {"text/html", "text/plain", "application/xhtml+xml"}:
            raise ValueError("The URL did not return an HTML or text page.")
        body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise ValueError("The page is larger than the 2 MB limit.")
        charset = response.headers.get_content_charset() or "utf-8"
        return body.decode(charset, errors="replace")


def count_words(text: str, excluded_words: set[str] | None = None) -> Counter[str]:
    excluded = DEFAULT_STOP_WORDS | {word.lower() for word in (excluded_words or set())}
    words = (match.group(0).lower() for match in re.finditer(r"[A-Za-z][A-Za-z'-]*", text))
    return Counter(word for word in words if len(word) > 1 and word not in excluded)


def discover_random_candidates() -> list[str]:
    query = urllib.parse.urlencode({
        "tags": "story",
        "hitsPerPage": 100,
        "page": random.randint(0, 9),
    })
    request = urllib.request.Request(
        f"{RANDOM_DISCOVERY_API}?{query}",
        headers={"User-Agent": "WordScope/1.0 (+local research tool)"},
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        body = response.read(1_000_001)
        if len(body) > 1_000_000:
            raise ValueError("The URL discovery service returned too much data.")
        data = json.loads(body.decode("utf-8"))

    candidates = [hit.get("url", "") for hit in data.get("hits", []) if hit.get("url")]
    random.shuffle(candidates)
    return candidates[:60]


def find_random_urls(count: int) -> list[str]:
    if not 1 <= count <= MAX_URLS:
        raise ValueError(f"Choose between 1 and {MAX_URLS} URLs.")

    try:
        candidates = discover_random_candidates()
    except Exception:
        candidates = []
    fallback_candidates = list(RANDOM_URL_CANDIDATES)
    random.shuffle(fallback_candidates)
    candidates.extend(fallback_candidates)
    urls: list[str] = []
    domains: set[str] = set()

    def verify_candidate(url: str) -> tuple[str, str] | None:
        try:
            safe_url = validate_public_url(url)
            domain = urllib.parse.urlparse(safe_url).hostname.removeprefix("www.")
            fetch_page(safe_url)
        except Exception:
            return None
        return safe_url, domain

    executor = ThreadPoolExecutor(max_workers=8)
    futures = [executor.submit(verify_candidate, url) for url in candidates]
    try:
        for future in as_completed(futures):
            result = future.result()
            if not result:
                continue
            safe_url, domain = result
            if domain in domains:
                continue
            urls.append(safe_url)
            domains.add(domain)
            if len(urls) == count:
                break
    finally:
        for future in futures:
            future.cancel()
        executor.shutdown(wait=False, cancel_futures=True)

    if len(urls) != count:
        raise ValueError("Could not find enough working URLs on distinct domains. Try again.")
    return urls


def analyze_urls(urls: list[str], top_count: int, excluded_words: set[str] | None = None) -> dict:
    if not 1 <= len(urls) <= MAX_URLS:
        raise ValueError(f"Choose between 1 and {MAX_URLS} URLs.")
    if not 1 <= top_count <= 100:
        raise ValueError("Top word count must be between 1 and 100.")

    total_counts: Counter[str] = Counter()
    pages = []
    for url in urls:
        try:
            raw_content = fetch_page(url)
            text = extract_visible_text(raw_content)
            counts = count_words(text, excluded_words)
            total_counts.update(counts)
            pages.append({"url": url, "status": "ok", "words": sum(counts.values())})
        except Exception as error:
            pages.append({"url": url, "status": "error", "error": str(error)})

    successful_pages = sum(page["status"] == "ok" for page in pages)
    if not successful_pages:
        raise ValueError("None of the supplied URLs could be analyzed.")

    return {
        "results": [{"word": word, "count": count} for word, count in total_counts.most_common(top_count)],
        "pages": pages,
        "successful_pages": successful_pages,
        "total_words": sum(total_counts.values()),
        "unique_words": len(total_counts),
    }