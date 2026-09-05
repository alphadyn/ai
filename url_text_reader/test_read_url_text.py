import unittest
from unittest.mock import patch

from url_text_reader.read_url_text import extract_visible_text, fetch_url_text


class UrlTextReaderTests(unittest.TestCase):
    def test_extract_visible_text_ignores_scripts_and_styles(self):
        html = "<h1>Reddit</h1><p>Hello <strong>world</strong></p><script>secret</script><style>.x {}</style>"

        text = extract_visible_text(html)

        self.assertEqual(text, "Reddit\nHello world")
        self.assertNotIn("secret", text)

    def test_fetch_url_text_uses_the_visible_text_extractor(self):
        with patch("url_text_reader.read_url_text.urllib.request.urlopen") as urlopen:
            response = urlopen.return_value.__enter__.return_value
            response.headers.get_content_charset.return_value = "utf-8"
            response.read.return_value = b"<p>Front page</p>"

            text = fetch_url_text("https://www.reddit.com/")

        self.assertEqual(text, "Front page")
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://www.reddit.com/")
        self.assertEqual(request.get_header("User-agent"), "url-text-reader/1.0")


if __name__ == "__main__":
    unittest.main()