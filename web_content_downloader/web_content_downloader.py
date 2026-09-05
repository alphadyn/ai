#!/usr/bin/env python3
"""Fetch a web page and print its visible text."""

import argparse
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import List, Optional, Tuple

IPHONE_SAFARI_USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 "
    "Mobile/15E148 Safari/604.1"
)


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


def fetch_url_text(url: str, cookie: Optional[str] = None) -> str:
    parsed_url = urllib.parse.urlparse(url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("URL must include an http:// or https:// scheme")

    request_url = url
    if parsed_url.hostname and parsed_url.hostname.lower() in {"reddit.com", "www.reddit.com"}:
        request_url = parsed_url._replace(netloc="old.reddit.com").geturl()

    headers = {
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": IPHONE_SAFARI_USER_AGENT,
    }
    if cookie:
        headers["Cookie"] = cookie

    request = urllib.request.Request(
        request_url,
        headers=headers,
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        html = response.read().decode(charset, errors="replace")
    return extract_visible_text(html)


def fetch_url_text_in_browser(
    url: str,
    cookie: Optional[str] = None,
    screenshot_path: str = "page_screenshot.png",
    output_path: str = "page_content.txt",
) -> str:
    """Open a visible browser, capture a screenshot, and save rendered text."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=False)
        try:
            headers = {"Accept-Language": "en-US,en;q=0.9"}
            if cookie:
                headers["Cookie"] = cookie
            page = browser.new_page(
                user_agent=IPHONE_SAFARI_USER_AGENT,
                extra_http_headers=headers,
            )
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            Path(screenshot_path).parent.mkdir(parents=True, exist_ok=True)
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=screenshot_path, full_page=True)
            text = page.locator("body").inner_text().strip()
            with open(output_path, "w", encoding="utf-8") as output_file:
                output_file.write(text + "\n")
        finally:
            browser.close()
    return text.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Display the visible text from a web page")
    parser.add_argument(
        "url",
        help="URL to fetch, such as https://example.com/",
    )
    parser.add_argument(
        "--cookie",
        help="Cookie header from an authorized browser session, if the site requires login",
    )
    parser.add_argument(
        "--browser",
        action="store_true",
        help="Open a browser, take a screenshot, and save rendered content",
    )
    parser.add_argument(
        "--screenshot",
        default="page_screenshot.png",
        help="Browser screenshot path (default: page_screenshot.png)",
    )
    parser.add_argument(
        "--output",
        default="page_content.txt",
        help="Browser text output path (default: page_content.txt)",
    )
    args = parser.parse_args()

    try:
        if args.browser:
            text = fetch_url_text_in_browser(
                args.url,
                cookie=args.cookie,
                screenshot_path=args.screenshot,
                output_path=args.output,
            )
        else:
            text = fetch_url_text(args.url, cookie=args.cookie)
    except (OSError, ValueError) as error:
        if isinstance(error, urllib.error.HTTPError) and error.code == 401:
            print(
                f"Unable to fetch {args.url}: Reuters returned a JavaScript access challenge. "
                "Retry with --browser or pass an authorized Cookie header with --cookie.",
                file=sys.stderr,
            )
            return 1
        print(f"Unable to fetch {args.url}: {error}", file=sys.stderr)
        return 1
    except Exception as error:
        print(f"Unable to fetch {args.url} in browser mode: {error}", file=sys.stderr)
        return 1

    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())