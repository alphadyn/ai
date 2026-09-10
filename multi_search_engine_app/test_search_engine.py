import unittest
from unittest.mock import patch

from multi_search_engine_app.search_engine import (
    AVAILABLE_ENGINES,
    DEFAULT_ENGINES,
    MultiSearchAggregator,
    SearchResult,
    clean_html,
    generate_fallback_results,
)


class TestSearchResult(unittest.TestCase):
    def test_to_one_line_format(self):
        result = SearchResult(
            engine="Google",
            title="Artificial Intelligence News",
            snippet="Latest developments in AI models and research.",
            link="https://www.google.com/search?q=ai",
        )
        self.assertEqual(result.summary, "Artificial Intelligence News: Latest developments in AI models and research.")
        one_line = result.to_one_line()
        self.assertTrue(one_line.startswith("[Google]"))
        self.assertIn("[Artificial Intelligence News: Latest developments in AI models and research.](https://www.google.com/search?q=ai)", one_line)
        self.assertEqual(one_line.count("\n"), 0)

    def test_to_one_line_strips_newlines_and_extra_spaces(self):
        result = SearchResult(
            engine="DuckDuckGo",
            title="Line 1\nLine 2",
            snippet="Snippet\r\nwith multiple   spaces and\nbreaks",
            link="https://duckduckgo.com/?q=test",
        )
        one_line = result.to_one_line()
        self.assertEqual(one_line.count("\n"), 0)
        self.assertEqual(one_line.count("\r"), 0)
        self.assertTrue(one_line.startswith("[DuckDuckGo]"))

    def test_clean_html_strips_tags_and_entities(self):
        raw = "<p>Hello <b>World</b> &amp; &lt;Universe&gt;</p><script>alert(1)</script>"
        cleaned = clean_html(raw)
        self.assertEqual(cleaned, "Hello World & <Universe>")


class TestMultiSearchAggregator(unittest.TestCase):
    def test_max_five_engines_enforced(self):
        # Even if 8 engines are provided, only 5 are accepted
        all_engine_keys = list(AVAILABLE_ENGINES.keys())
        aggregator = MultiSearchAggregator(engines=all_engine_keys, max_results_per_engine=10)
        self.assertEqual(len(aggregator.engines), 5)

    def test_max_ten_results_per_engine_enforced(self):
        # Even if requested 50, capped at 10
        aggregator = MultiSearchAggregator(engines=["google"], max_results_per_engine=50)
        self.assertEqual(aggregator.max_results_per_engine, 10)

        # Capped at minimum 1
        aggregator_min = MultiSearchAggregator(engines=["google"], max_results_per_engine=0)
        self.assertEqual(aggregator_min.max_results_per_engine, 1)

    def test_empty_query_returns_zero_results(self):
        aggregator = MultiSearchAggregator(engines=DEFAULT_ENGINES[:5], max_results_per_engine=10)
        report = aggregator.search("")
        self.assertEqual(report["total_results"], 0)
        self.assertEqual(len(report["one_line_report"]), 0)

    def test_fallback_results_structure(self):
        results = generate_fallback_results("Google", "machine learning", max_results=10)
        self.assertEqual(len(results), 10)
        for res in results:
            self.assertEqual(res.engine, "Google")
            self.assertTrue(res.link.startswith("http"))
            self.assertIn("machine learning", res.title.lower() + res.snippet.lower())
            line = res.to_one_line()
            self.assertTrue(line.startswith("[Google]"))
            self.assertEqual(line.count("\n"), 0)

    def test_search_produces_one_line_findings_report(self):
        aggregator = MultiSearchAggregator(
            engines=["google", "bing", "duckduckgo", "yahoo", "wikipedia"],
            max_results_per_engine=10,
        )
        report = aggregator.search("artificial intelligence")
        self.assertEqual(len(report["engines_queried"]), 5)
        self.assertLessEqual(report["total_results"], 50)
        self.assertEqual(len(report["one_line_report"]), report["total_results"])

        # Check that every line has the [Engine] [Summary](Link) pattern where summary is a link to destination
        for line in report["one_line_report"]:
            self.assertRegex(line, r"^\[[\w\s]+\] \[.+\]\(https?://\S+\)")
            self.assertEqual(line.count("\n"), 0)

    def test_generate_report_text(self):
        aggregator = MultiSearchAggregator(
            engines=["google", "bing", "duckduckgo", "yahoo", "wikipedia"],
            max_results_per_engine=5,
        )
        text = aggregator.generate_report_text("climate change")
        self.assertIn("MULTI-ENGINE SEARCH REPORT FOR: \"climate change\"", text)
        self.assertIn("ONE-LINE SEARCH FINDINGS:", text)
        self.assertIn("[Google]", text)
        self.assertIn("[Bing]", text)
        self.assertIn("[DuckDuckGo]", text)
        self.assertIn("[Yahoo]", text)
        self.assertIn("[Wikipedia]", text)


if __name__ == "__main__":
    unittest.main()
