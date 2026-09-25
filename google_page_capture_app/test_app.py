import json
from datetime import datetime, timezone

from google_page_capture_app.app import (
    app,
    extract_news_items,
    format_capture_json,
    save_news_json,
)


def test_web_home_and_capture_status_routes():
    client = app.test_client()

    page = client.get("/")
    status = client.get("/api/status")

    assert page.status_code == 200
    assert b"Headlines" in page.data
    assert status.status_code == 200
    assert status.json["status"] in {"idle", "running", "complete", "error"}
    assert isinstance(status.json["news"], list)


def test_extract_news_items_normalizes_links_and_deduplicates():
    records = [
        {
            "title": "  Main   headline ",
            "url": "/articles/main?story=1",
            "subtitles": [
                {"title": " Related story ", "url": "/articles/related"},
                {"title": "Related story", "url": "/articles/related"},
                {"title": "", "url": "/articles/empty"},
            ],
        },
        {"title": "Main headline", "url": "/articles/main?story=1", "subtitles": []},
        {"title": "No link", "url": "", "subtitles": []},
    ]

    items = extract_news_items(records, "https://news.google.com/home")

    assert items == [
        {
            "header_title": "Main headline",
            "header_url": "https://news.google.com/articles/main?story=1",
            "subtitles": [
                {
                    "title": "Related story",
                    "url": "https://news.google.com/articles/related",
                }
            ],
        }
    ]


def test_format_capture_json_is_structured_and_preserves_unicode():
    captured_at = datetime(2025, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    news = [{"header_title": "Café news", "header_url": "https://example.com", "subtitles": []}]

    result = format_capture_json(news, "https://news.google.com/", captured_at)
    document = json.loads(result)

    assert document == {
        "source_url": "https://news.google.com/",
        "captured_at_utc": "2025-01-02T03:04:05+00:00",
        "news": news,
    }
    assert "Café news" in result


def test_save_news_json_creates_parent_and_writes_text_file(tmp_path):
    destination = tmp_path / "captures" / "google_news.txt"
    news = [{"header_title": "Headline", "header_url": "https://example.com/story", "subtitles": []}]

    saved_path = save_news_json(news, "https://news.google.com/", destination)

    assert saved_path == destination.resolve()
    assert json.loads(destination.read_text(encoding="utf-8"))["news"] == news
