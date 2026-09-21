# WordScope

WordScope analyzes visible text across multiple web pages and ranks the most common words.

## Features

- Configure between 1 and 20 web URLs
- Fill the URL fields with live random Wikipedia articles
- Display between 1 and 100 top words in descending frequency order
- Click any result to exclude it and recalculate the report
- Click an excluded word to restore it
- Review per-page success, failure, and counted-word details
- Ignore common English stop words, scripts, styles, and other non-visible markup
- Block private/local network targets, unsafe redirects, non-text responses, and pages over 2 MB

## Run

The app needs its local Python server to fetch pages without browser CORS restrictions:

```bash
cd word_frequency_app
python3 server.py --port 8000
```

Open http://127.0.0.1:8000.

Some sites block automated requests, require authentication, or render all content with JavaScript. Those pages will appear as errors in **Source details** and will not contribute to the totals.

## Test

From the repository root:

```bash
python3 -m pytest word_frequency_app/test_analyzer.py -q
```