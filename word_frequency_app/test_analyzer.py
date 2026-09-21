import json
import unittest
from unittest.mock import patch

from word_frequency_app.analyzer import analyze_urls, count_words, extract_visible_text, find_random_urls, validate_public_url
from word_frequency_app.server import parse_analysis_request


class AnalyzerTests(unittest.TestCase):
    def test_extract_visible_text_ignores_non_content_elements(self):
        html = "<main>Hello world</main><script>hidden words</script><style>.hidden {}</style>"
        self.assertEqual(extract_visible_text(html), "Hello world")

    def test_count_words_omits_stop_and_excluded_words(self):
        counts = count_words("The signal signal noise and data data data", {"data"})
        self.assertEqual(counts, {"signal": 2, "noise": 1})

    @patch("word_frequency_app.analyzer.fetch_page")
    def test_analyze_urls_aggregates_and_ranks_pages(self, fetch_page):
        fetch_page.side_effect = [
            "<p>signal signal pattern</p>",
            "<p>pattern signal context context context</p>",
        ]

        report = analyze_urls(["https://one.example", "https://two.example"], 2, {"context"})

        self.assertEqual(report["results"], [
            {"word": "signal", "count": 3},
            {"word": "pattern", "count": 2},
        ])
        self.assertEqual(report["successful_pages"], 2)
        self.assertEqual(report["total_words"], 5)

    def test_analyze_urls_validates_limits(self):
        with self.assertRaisesRegex(ValueError, "between 1 and 20"):
            analyze_urls([], 10)
        with self.assertRaisesRegex(ValueError, "between 1 and 100"):
            analyze_urls(["https://example.com"], 101)

    def test_validate_public_url_blocks_local_addresses(self):
        with self.assertRaisesRegex(ValueError, "Private and local"):
            validate_public_url("http://127.0.0.1/private")

    @patch("word_frequency_app.analyzer.validate_public_url", side_effect=lambda url: url)
    @patch("word_frequency_app.analyzer.urllib.request.urlopen")
    def test_find_random_urls_returns_unique_live_article_urls(self, urlopen, _validate):
        response = urlopen.return_value.__enter__.return_value
        response.read.return_value = json.dumps({
            "query": {
                "pages": [
                    {"fullurl": "https://en.wikipedia.org/wiki/Signal"},
                    {"fullurl": "https://en.wikipedia.org/wiki/Pattern"},
                ],
            },
        }).encode("utf-8")

        urls = find_random_urls(2)

        self.assertEqual(urls, [
            "https://en.wikipedia.org/wiki/Signal",
            "https://en.wikipedia.org/wiki/Pattern",
        ])
        requested_url = urlopen.call_args.args[0].full_url
        self.assertIn("generator=random", requested_url)
        self.assertIn("grnlimit=2", requested_url)

    def test_parse_analysis_request_normalizes_values(self):
        urls, top_count, excluded = parse_analysis_request({
            "urls": [" https://example.com "],
            "top_count": 12,
            "excluded_words": ["Signal", ""],
        })
        self.assertEqual(urls, ["https://example.com"])
        self.assertEqual(top_count, 12)
        self.assertEqual(excluded, {"signal"})


if __name__ == "__main__":
    unittest.main()