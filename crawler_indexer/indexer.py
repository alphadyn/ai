#!/usr/bin/env python3
"""Simple crawler and indexer for URLs or local files."""

import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from typing import List, Dict, Any


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: List[str] = []
        self._skip = False

    def handle_starttag(self, tag: str, attrs: List[tuple]) -> None:
        if tag in {"script", "style", "noscript"}:
            self._skip = True
        if tag in {"p", "div", "section", "article", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "tr", "table", "br"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"}:
            self._skip = False
        if tag in {"p", "div", "section", "article", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "tr", "table", "br"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip:
            return
        cleaned = re.sub(r"\s+", " ", data).strip()
        if cleaned:
            self.parts.append(cleaned)

    def get_text(self) -> str:
        return " ".join(self.parts)


class LinkParser(HTMLParser):
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


def normalize_token(token: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", token.lower())


def build_index(text: str) -> Dict[str, int]:
    counts: Counter[str] = Counter()
    for match in re.finditer(r"[A-Za-z0-9]+", text):
        token = normalize_token(match.group(0))
        if token:
            counts[token] += 1
    return dict(counts)


def extract_text_from_html(html: str) -> str:
    parser = TextExtractor()
    parser.feed(html)
    parser.close()
    return parser.get_text()


def extract_links_from_html(html: str) -> List[str]:
    parser = LinkParser()
    parser.feed(html)
    parser.close()
    return parser.links


def fetch_url(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=10) as response:
        body = response.read()
    content_type = response.headers.get_content_type()
    if content_type.startswith("text/html"):
        charset = response.headers.get_content_charset() or "utf-8"
        return body.decode(charset, errors="ignore")
    return body.decode("utf-8", errors="ignore")


def crawl_url(start_url: str, max_pages: int = 10, same_domain: bool = False) -> List[Dict[str, Any]]:
    seen = {start_url}
    queue = [start_url]
    results: List[Dict[str, Any]] = []
    start_netloc = urllib.parse.urlparse(start_url).netloc if same_domain else None

    while queue and len(results) < max_pages:
        current_url = queue.pop()

        try:
            html = fetch_url(current_url)
        except Exception:
            continue

        text = extract_text_from_html(html)
        index = build_index(text)
        results.append({"url": current_url, "text": text, "index": index})

        for href in extract_links_from_html(html):
            absolute_url = urllib.parse.urljoin(current_url, href)
            if not absolute_url.startswith("http") or absolute_url in seen:
                continue
            if same_domain and urllib.parse.urlparse(absolute_url).netloc != start_netloc:
                continue
            seen.add(absolute_url)
            queue.append(absolute_url)

    return results


def index_local_file(path: str) -> Dict[str, Any]:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    content = file_path.read_text(encoding="utf-8", errors="ignore")
    return {
        "type": "file",
        "path": str(file_path.resolve()),
        "index": build_index(content),
        "text": content,
    }


def index_local_directory(path: str) -> Dict[str, Any]:
    directory = Path(path)
    if not directory.exists() or not directory.is_dir():
        raise FileNotFoundError(f"Directory not found: {path}")

    documents = []
    for file_path in sorted(directory.rglob("*")):
        if file_path.is_file() and file_path.suffix.lower() in {".txt", ".md", ".py", ".json", ".csv", ".html"}:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            documents.append({
                "path": str(file_path.resolve()),
                "index": build_index(content),
            })

    return {"type": "directory", "path": str(directory.resolve()), "documents": documents}


def main() -> None:
    parser = argparse.ArgumentParser(description="Index a URL or a local file/directory")
    parser.add_argument("target", help="A URL, file path, or directory path")
    parser.add_argument("--max-pages", type=int, default=10, help="Maximum number of web pages to crawl")
    parser.add_argument("--same-domain", action="store_true", help="Only follow links within the same domain as the input URL")
    parser.add_argument("--output", default="index.json", help="Where to save the index JSON")
    args = parser.parse_args()

    target = args.target
    output_path = Path(args.output)

    if target.startswith(("http://", "https://")):
        documents = crawl_url(target, max_pages=args.max_pages, same_domain=args.same_domain)
        payload = {"type": "url", "source": target, "documents": documents}
    else:
        path = Path(target)
        if path.exists() and path.is_dir():
            payload = index_local_directory(target)
        else:
            payload = index_local_file(target)

    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Indexed content saved to {output_path}")


if __name__ == "__main__":
    main()
