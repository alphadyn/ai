# Wikipedia URL Crawler

Recursively follows article links from English Wikipedia, removes duplicates, and writes up to 1,000,000 visited URLs as JSON Lines. Each output line has the form `{"url": "https://en.wikipedia.org/wiki/..."}`.

## Usage

From the repository root:

```bash
python3 wikipedia_crawler/wikipedia_crawler.py --max-urls 10000 --output wikipedia_urls.jsonl
```

The default starting page is `https://en.wikipedia.org/wiki/Main_Page`. Choose another article and use a slower request interval when needed:

```bash
python3 wikipedia_crawler/wikipedia_crawler.py \
  --start-url https://en.wikipedia.org/wiki/Python_(programming_language) \
  --max-urls 1000000 \
  --delay 0.2 \
  --output data/wikipedia_urls.jsonl
```

The crawler only follows article URLs on `en.wikipedia.org`, skips namespace pages such as `Help:` and `Special:`, strips fragments and query strings, and tracks discovered URLs to avoid repetition. It writes each successfully fetched URL immediately, so the output remains usable if the crawl is interrupted.

## Test

```bash
python3 -m unittest wikipedia_crawler/test_wikipedia_crawler.py
```