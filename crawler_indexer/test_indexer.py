import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from crawler_indexer.indexer import (
    build_index,
    crawl_url,
    extract_text_from_html,
    index_local_directory,
)


class IndexerTests(unittest.TestCase):
    def test_extract_text_from_html_strips_script_and_keeps_visible_content(self):
        html = """
        <html><body>
            <script>ignore me</script>
            <p>Hello <strong>world</strong></p>
            <div>Again</div>
        </body></html>
        """

        text = extract_text_from_html(html)

        self.assertIn("Hello", text)
        self.assertIn("world", text)
        self.assertIn("Again", text)
        self.assertNotIn("ignore me", text)

    def test_build_index_counts_tokens_case_insensitively(self):
        index = build_index("Alpha alpha, beta! Beta")

        self.assertEqual(index["alpha"], 2)
        self.assertEqual(index["beta"], 2)

    def test_crawl_url_fetches_and_deduplicates_pages(self):
        html_page_one = "<html><body><p>first page</p><a href='http://example.com/page-two'>next</a></body></html>"
        html_page_two = "<html><body><p>second page</p></body></html>"

        with patch("crawler_indexer.indexer.fetch_url", side_effect=[html_page_one, html_page_two]):
            results = crawl_url("http://example.com/page-one", max_pages=5)

        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["url"], "http://example.com/page-one")
        self.assertIn("first page", results[0]["text"])
        self.assertEqual(results[1]["url"], "http://example.com/page-two")
        self.assertIn("second page", results[1]["text"])

    def test_index_local_directory_reads_text_like_files(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "notes.txt").write_text("alpha beta\n", encoding="utf-8")
            (root / "nested").mkdir()
            (root / "nested" / "readme.md").write_text("gamma delta", encoding="utf-8")
            (root / "ignore.bin").write_bytes(b"\x00\x01\x02")

            payload = index_local_directory(str(root))

            self.assertEqual(payload["type"], "directory")
            self.assertEqual(len(payload["documents"]), 2)
            self.assertTrue(any(doc["index"].get("alpha", 0) == 1 for doc in payload["documents"]))
            self.assertTrue(any(doc["index"].get("gamma", 0) == 1 for doc in payload["documents"]))


if __name__ == "__main__":
    unittest.main()
