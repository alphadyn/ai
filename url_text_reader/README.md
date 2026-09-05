# URL Text Reader

Fetches a URL and prints the visible text from its HTML response to the terminal.

## Usage

From the repository root:

```bash
python3 url_text_reader/read_url_text.py https://example.com/
```

Fetch any public web page:

```bash
python3 url_text_reader/read_url_text.py https://www.example.com/article
```

The program requires an `http://` or `https://` URL, ignores scripts and styles, and reports network errors without a traceback. It reads the HTML returned by the server, so text rendered only by client-side JavaScript is not included.

## Test

```bash
python3 -m unittest url_text_reader/test_read_url_text.py
```