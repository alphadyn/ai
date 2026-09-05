#!/usr/bin/env python3
"""Fetch a web page and print its visible text."""

import argparse
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import List, Optional, Tuple


class VisibleTextParser(HTMLParser):
    """Collect readable HTML text while ignoring non-visible elements."""

    def __init__(self) -> None:
        super().__init__()
        self.parts: List[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        if tag in {"script", "style", "noscript", "template"}:
            self._ignored_depth += 1
        elif tag in {"article", "br", "div", "h1", "h2", "h3", "li", "p", "section"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "template"} and self._ignored_depth:
            self._ignored_depth -= 1
        elif tag in {"article", "br", "div", "h1", "h2", "h3", "li", "p", "section"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth:
            text = re.sub(r"\s+", " ", data)
            if text.strip():
                self.parts.append(text)

    def text(self) -> str:
        lines = (part.strip() for part in "".join(self.parts).splitlines())
        return "\n".join(line for line in lines if line)


def extract_visible_text(html: str) -> str:
    parser = VisibleTextParser()
    parser.feed(html)
    parser.close()
    return parser.text()


def fetch_url_text(url: str) -> str:
    parsed_url = urllib.parse.urlparse(url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("URL must include an http:// or https:// scheme")

    request = urllib.request.Request(
        url,
        headers={
            "Accept": "text/html",
            "User-Agent": "url-text-reader/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        html = response.read().decode(charset, errors="replace")
    return extract_visible_text(html)


def main() -> int:
    parser = argparse.ArgumentParser(description="Display the visible text from a web page")
    parser.add_argument(
        "url",
        help="URL to fetch, such as https://example.com/",
    )
    args = parser.parse_args()

    try:
        text = fetch_url_text(args.url)
    except (OSError, ValueError) as error:
        print(f"Unable to fetch {args.url}: {error}", file=sys.stderr)
        return 1

    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())