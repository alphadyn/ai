# Web Content Downloader

Fetches a URL and prints the visible text from its HTML response to the terminal.

## Usage

From the repository root:

```bash
python3 web_content_downloader/web_content_downloader.py https://example.com/
```

Fetch any public web page:

```bash
python3 web_content_downloader/web_content_downloader.py https://www.example.com/article
```

The program requires an `http://` or `https://` URL, requests content using an iPhone Safari user agent, ignores scripts and styles, and reports network errors without a traceback. It reads the HTML returned by the server, so text rendered only by client-side JavaScript is not included.

For `reddit.com` URLs, the reader uses Reddit's server-rendered legacy endpoint so page text can be extracted without running JavaScript.

Reuters may return `401 Unauthorized` unless the request has an authorized session. Supply the `Cookie` header copied from your browser session when permitted:

```bash
python3 web_content_downloader/web_content_downloader.py https://www.reuters.com/world/ --cookie 'session=...'
```

For Reuters and other pages protected by a JavaScript challenge, use the browser mode. It requires Playwright and an installed Chromium browser:

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
python3 web_content_downloader/web_content_downloader.py https://reddit.com --browser
```

Browser mode navigates to the supplied URL, saves a full-page screenshot as `page_screenshot.png`, writes the rendered text to `page_content.txt`, and also prints the text. Choose different paths with `--screenshot` and `--output`:

```bash
python3 web_content_downloader/web_content_downloader.py https://reddit.com --browser \
	--screenshot artifacts/reddit.png --output artifacts/reddit.txt
```

## Test

```bash
python3 -m unittest web_content_downloader/test_web_content_downloader.py
```