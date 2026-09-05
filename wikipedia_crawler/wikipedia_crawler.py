#!/usr/bin/env python3
"""Recursively record English Wikipedia article URLs."""

import argparse
import json
import time
import urllib.parse
import urllib.request
from collections import deque
from html.parser import HTMLParser
from pathlib import Path
from typing import Deque, Iterable, List, Optional, Set


WIKIPEDIA_HOST = "en.wikipedia.org"
DEFAULT_START_URL = "https://en.wikipedia.org/wiki/Main_Page"
USER_AGENT = "wikipedia-url-crawler/1.0 (educational project)"


class WikipediaLinkParser(HTMLParser):
    """Extract links from article HTML."""

    def __init__(self) -> None:
        super().__init__()
        self.links: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[tuple]) -> None:
        if tag != "a":
            return
        for name, value in attrs:
            if name == "href" and value:
                self.links.append(value)
                break


def normalize_article_url(url: str) -> Optional[str]:
    """Return a canonical English Wikipedia article URL, or None to skip it."""
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in {"http", "https"}:
        return None
    if (parsed.hostname or "").lower() != WIKIPEDIA_HOST:
        return None
    if not parsed.path.startswith("/wiki/"):
        return None

    article_path = urllib.parse.unquote(parsed.path)
    title = article_path[len("/wiki/"):]
    if not title or ":" in title:
        return None

    normalized_path = "/wiki/" + urllib.parse.quote(title.replace(" ", "_"), safe="()/,:;@&=+$-._~!'*#")
    return urllib.parse.urlunsplit(("https", WIKIPEDIA_HOST, normalized_path, "", ""))


def extract_article_links(html: str, page_url: str) -> Iterable[str]:
    parser = WikipediaLinkParser()
    parser.feed(html)
    parser.close()
    for href in parser.links:
        absolute_url = urllib.parse.urljoin(page_url, href)
        normalized_url = normalize_article_url(absolute_url)
        if normalized_url:
            yield normalized_url


def fetch_html(url: str, timeout: int = 20) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def crawl_wikipedia(
    start_url: str = DEFAULT_START_URL,
    max_urls: int = 1_000_000,
    output_path: str = "wikipedia_urls.jsonl",
    delay: float = 0.1,
) -> int:
    """Crawl and save up to max_urls unique article URLs as JSON Lines."""
    if max_urls < 1 or max_urls > 1_000_000:
        raise ValueError("max_urls must be between 1 and 1,000,000")
    normalized_start = normalize_article_url(start_url)
    if not normalized_start:
        raise ValueError("start_url must be an English Wikipedia article URL")
    if delay < 0:
        raise ValueError("delay cannot be negative")

    queue: Deque[str] = deque([normalized_start])
    visited: Set[str] = {normalized_start}
    recorded = 0
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with output.open("w", encoding="utf-8") as stream:
        while queue and recorded < max_urls:
            current_url = queue.popleft()
            try:
                html = fetch_html(current_url)
            except Exception as error:
                print(f"Skipping {current_url}: {error}")
                continue

            stream.write(json.dumps({"url": current_url}) + "\n")
            stream.flush()
            recorded += 1

            if recorded < max_urls:
                for link in extract_article_links(html, current_url):
                    if link not in visited:
                        visited.add(link)
                        queue.append(link)
            if delay and queue:
                time.sleep(delay)

            if recorded % 1000 == 0:
                print(f"Recorded {recorded:,} URLs; queued {len(queue):,}")

    return recorded


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Recursively record unique English Wikipedia article URLs"
    )
    parser.add_argument("--start-url", default=DEFAULT_START_URL, help="Starting Wikipedia article URL")
    parser.add_argument("--max-urls", type=int, default=1_000_000, help="Maximum URLs to record (1-1,000,000)")
    parser.add_argument("--output", default="wikipedia_urls.jsonl", help="JSONL output path")
    parser.add_argument("--delay", type=float, default=0.1, help="Seconds between requests")
    args = parser.parse_args()

    try:
        recorded = crawl_wikipedia(args.start_url, args.max_urls, args.output, args.delay)
    except (OSError, ValueError) as error:
        parser.error(str(error))
        return 2

    print(f"Saved {recorded:,} unique Wikipedia URLs to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())