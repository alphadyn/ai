# Reddit Text Reader

Fetches a Reddit page and prints its visible HTML text to the terminal.

## Usage

From the repository root:

```bash
python3 reddit_text/get_reddit_text.py
```

Fetch a specific public Reddit page:

```bash
python3 reddit_text/get_reddit_text.py https://www.reddit.com/r/python/
```

The program uses a descriptive `User-Agent`, ignores scripts and styles, and reports network errors without a traceback. Reddit may return a limited or blocked page depending on its rate limits and access policies.

## Test

```bash
python3 -m unittest reddit_text/test_get_reddit_text.py
```