import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from wikipedia_crawler.wikipedia_crawler import (
    crawl_wikipedia,
    extract_article_links,
    normalize_article_url,
)


class WikipediaCrawlerTests(unittest.TestCase):
    def test_normalize_article_url_filters_non_articles(self):
        self.assertEqual(
            normalize_article_url("http://en.wikipedia.org/wiki/Python_(programming_language)#History"),
            "https://en.wikipedia.org/wiki/Python_(programming_language)",
        )
        self.assertIsNone(normalize_article_url("https://en.wikipedia.org/wiki/Special:Random"))
        self.assertIsNone(normalize_article_url("https://fr.wikipedia.org/wiki/Python"))

    def test_extract_article_links_resolves_and_filters_links(self):
        html = """
        <a href="/wiki/Alpha">Alpha</a>
        <a href="/wiki/Alpha#section">Duplicate</a>
        <a href="/wiki/Help:Contents">Help</a>
        <a href="https://example.com/outside">Outside</a>
        """

        links = list(extract_article_links(html, "https://en.wikipedia.org/wiki/Main_Page"))

        self.assertEqual(links, [
            "https://en.wikipedia.org/wiki/Alpha",
            "https://en.wikipedia.org/wiki/Alpha",
        ])

    def test_crawl_writes_unique_urls_as_json_lines(self):
        pages = {
            "https://en.wikipedia.org/wiki/Main_Page": '<a href="/wiki/Alpha">Alpha</a><a href="/wiki/Beta">Beta</a>',
            "https://en.wikipedia.org/wiki/Alpha": '<a href="/wiki/Beta">Beta</a>',
            "https://en.wikipedia.org/wiki/Beta": "<p>Done</p>",
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "urls.jsonl"
            with patch("wikipedia_crawler.wikipedia_crawler.fetch_html", side_effect=pages.__getitem__):
                recorded = crawl_wikipedia(output_path=str(output_path), max_urls=3, delay=0)

            rows = [json.loads(line) for line in output_path.read_text(encoding="utf-8").splitlines()]

        self.assertEqual(recorded, 3)
        self.assertEqual([row["url"] for row in rows], list(pages))


if __name__ == "__main__":
    unittest.main()