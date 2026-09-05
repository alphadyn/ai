import unittest
from unittest.mock import patch

from web_content_downloader.web_content_downloader import (
    IPHONE_SAFARI_USER_AGENT,
    extract_visible_text,
    fetch_url_text,
)


class UrlTextReaderTests(unittest.TestCase):
    def test_extract_visible_text_ignores_scripts_and_styles(self):
        html = "<h1>Reddit</h1><p>Hello <strong>world</strong></p><script>secret</script><style>.x {}</style>"

        text = extract_visible_text(html)

        self.assertEqual(text, "Reddit\nHello world")
        self.assertNotIn("secret", text)

    def test_fetch_url_text_uses_the_visible_text_extractor(self):
        with patch("web_content_downloader.web_content_downloader.urllib.request.urlopen") as urlopen:
            response = urlopen.return_value.__enter__.return_value
            response.headers.get_content_charset.return_value = "utf-8"
            response.read.return_value = b"<p>Front page</p>"

            text = fetch_url_text("https://www.reddit.com/")

        self.assertEqual(text, "Front page")
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://old.reddit.com/")
        self.assertEqual(request.get_header("User-agent"), IPHONE_SAFARI_USER_AGENT)
        self.assertEqual(request.get_header("Accept-language"), "en-US,en;q=0.9")

    def test_fetch_url_text_preserves_non_reddit_urls(self):
        with patch("web_content_downloader.web_content_downloader.urllib.request.urlopen") as urlopen:
            response = urlopen.return_value.__enter__.return_value
            response.headers.get_content_charset.return_value = "utf-8"
            response.read.return_value = b"<p>Example</p>"

            fetch_url_text("https://example.com/article")

        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.com/article")

    def test_fetch_url_text_can_use_an_authorized_cookie(self):
        with patch("web_content_downloader.web_content_downloader.urllib.request.urlopen") as urlopen:
            response = urlopen.return_value.__enter__.return_value
            response.headers.get_content_charset.return_value = "utf-8"
            response.read.return_value = b"<p>Reuters article</p>"

            fetch_url_text("https://www.reuters.com/world/", cookie="session=authorized")

        request = urlopen.call_args.args[0]
        self.assertEqual(request.get_header("Cookie"), "session=authorized")


if __name__ == "__main__":
    unittest.main()