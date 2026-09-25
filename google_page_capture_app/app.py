#!/usr/bin/env python3
"""Serve a web app that captures Google News headlines with Chromium."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import threading
from urllib.parse import urljoin

from flask import Flask, jsonify, render_template, send_file

GOOGLE_NEWS_URL = "https://news.google.com/"
DEFAULT_OUTPUT = Path(__file__).with_name("google_news.json")
app = Flask(__name__)
capture_lock = threading.Lock()
capture_state: dict[str, object] = {
    "status": "idle",
    "message": "Ready to collect the latest headlines.",
    "news": [],
    "error": None,
}


def extract_news_items(records: list[dict[str, object]], base_url: str) -> list[dict[str, object]]:
    """Normalize extracted Google News article cards into a stable JSON schema."""
    items: list[dict[str, object]] = []
    seen_headers: set[tuple[str, str]] = set()

    def normalize_link(value: object) -> str:
        link = str(value or "").strip()
        return urljoin(base_url, link) if link else ""

    for record in records:
        title = " ".join(str(record.get("title") or "").split())
        header_url = normalize_link(record.get("url"))
        if not title or not header_url or (title, header_url) in seen_headers:
            continue

        subtitles: list[dict[str, str]] = []
        seen_subtitles: set[tuple[str, str]] = set()
        raw_subtitles = record.get("subtitles", [])
        if isinstance(raw_subtitles, list):
            for subtitle in raw_subtitles:
                if not isinstance(subtitle, dict):
                    continue
                subtitle_title = " ".join(str(subtitle.get("title") or "").split())
                subtitle_url = normalize_link(subtitle.get("url"))
                key = (subtitle_title, subtitle_url)
                if (
                    subtitle_title
                    and subtitle_url
                    and key != (title, header_url)
                    and key not in seen_subtitles
                ):
                    subtitles.append({"title": subtitle_title, "url": subtitle_url})
                    seen_subtitles.add(key)

        items.append({"header_title": title, "header_url": header_url, "subtitles": subtitles})
        seen_headers.add((title, header_url))

    return items


def format_capture_json(
    news_items: list[dict[str, object]],
    page_url: str,
    captured_at: datetime | None = None,
) -> str:
    """Serialize the captured news cards and capture metadata as readable JSON."""
    timestamp = captured_at or datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    timestamp = timestamp.astimezone(timezone.utc)
    document = {
        "source_url": page_url,
        "captured_at_utc": timestamp.isoformat(timespec="seconds"),
        "news": news_items,
    }
    return json.dumps(document, ensure_ascii=False, indent=2) + "\n"


def save_news_json(
    news_items: list[dict[str, object]],
    page_url: str,
    output_path: str | Path,
    captured_at: datetime | None = None,
) -> Path:
    """Write the news JSON document to disk as UTF-8."""
    destination = Path(output_path).expanduser()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(format_capture_json(news_items, page_url, captured_at), encoding="utf-8")
    return destination.resolve()


def capture_google_news() -> tuple[list[dict[str, object]], str]:
    """Load Google News in headless Chromium and return normalized story cards."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.goto(GOOGLE_NEWS_URL, wait_until="domcontentloaded", timeout=45_000)
            page.evaluate(
                """async () => {
                  let previousHeight = 0;
                  let stablePasses = 0;
                  for (let pass = 0; pass < 15 && stablePasses < 3; pass += 1) {
                    window.scrollTo(0, document.body.scrollHeight);
                    await new Promise((resolve) => setTimeout(resolve, 900));
                    const height = document.body.scrollHeight;
                    stablePasses = height === previousHeight ? stablePasses + 1 : 0;
                    previousHeight = height;
                  }
                  window.scrollTo(0, 0);
                }"""
            )
            records = page.evaluate(
                """() => {
                  const clean = (value) => (value || '')
                    .replace(/chevron_right/g, '')
                    .replace(/\\s+/g, ' ')
                    .trim();
                  const toStory = (anchor) => ({
                    title: clean(anchor.innerText || anchor.getAttribute('aria-label')),
                    url: anchor.href || anchor.getAttribute('href') || ''
                  });
                  const uniqueStories = (anchors) => {
                    const seen = new Set();
                    return anchors.map(toStory).filter((story) => {
                      if (!story.title || !story.url) return false;
                      const key = `${story.title}\\n${story.url}`;
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return true;
                    });
                  };
                  const grouped = [];
                  const seenHeaders = new Set();
                  const groupedSubtitleUrls = new Set();
                  for (const anchor of document.querySelectorAll('a[href*="/stories/"]')) {
                    let container = anchor.parentElement;
                    while (container && container !== document.body &&
                           !container.querySelector('a[href*="/read/"]')) {
                      container = container.parentElement;
                    }
                    const header = toStory(anchor);
                    if (!header.title || !header.url ||
                        header.title.toLowerCase().startsWith('see more') ||
                        seenHeaders.has(header.url)) continue;
                    seenHeaders.add(header.url);
                    const subtitles = uniqueStories(
                      Array.from(container?.querySelectorAll('a[href*="/read/"]') || [])
                    );
                    subtitles.forEach((story) => groupedSubtitleUrls.add(story.url));
                    grouped.push({ ...header, subtitles });
                  }
                  const standalone = uniqueStories(
                    Array.from(document.querySelectorAll('a[href*="/read/"]'))
                      .filter((anchor) => !groupedSubtitleUrls.has(anchor.href))
                  ).map((story) => ({ ...story, subtitles: [] }));
                  return [...grouped, ...standalone];
                }"""
            )
            news_items = extract_news_items(records, page.url)
            if not news_items:
                raise RuntimeError(
                    "Google News loaded, but no headlines were found. The page markup "
                    "may have changed or the feed did not finish loading."
                )
            return news_items, page.url
        finally:
            browser.close()


def run_capture() -> None:
    """Capture headlines in a worker thread and publish the result to the API."""
    try:
        news_items, page_url = capture_google_news()
        captured_at = datetime.now(timezone.utc)
        save_news_json(news_items, page_url, DEFAULT_OUTPUT, captured_at)
        with capture_lock:
            capture_state.update(
                status="complete",
                message=f"Captured {len(news_items)} headlines successfully.",
                news=news_items,
                source_url=page_url,
                captured_at_utc=captured_at.isoformat(timespec="seconds"),
                error=None,
            )
    except Exception as error:
        with capture_lock:
            capture_state.update(
                status="error",
                message="The capture could not be completed.",
                error=str(error),
            )


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/capture")
def start_capture():
    with capture_lock:
        if capture_state["status"] == "running":
            return jsonify(error="A capture is already running."), 409
        capture_state.clear()
        capture_state.update(
            status="running",
            message="Launching Chromium and loading the Google News feed…",
            news=[],
            error=None,
        )
    threading.Thread(target=run_capture, daemon=True).start()
    return jsonify(status="running"), 202


@app.get("/api/status")
def capture_status():
    with capture_lock:
        return jsonify(capture_state.copy())


@app.get("/api/download")
def download_capture():
    if not DEFAULT_OUTPUT.is_file():
        return jsonify(error="No capture is available to download yet."), 404
    return send_file(
        DEFAULT_OUTPUT,
        as_attachment=True,
        download_name="google_news.json",
        mimetype="application/json",
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
