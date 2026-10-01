# Crawler Indexer

This folder contains a small Python script that can index content from a URL, a local file, or a local directory.

## What it does
- Crawls web pages from a starting URL
- Extracts visible text from HTML
- Builds a simple word frequency index
- Deduplicates pages by URL and by content fingerprint — identical pages served at different URLs are only indexed once
- Saves the result as JSON to a chosen output file

## Usage
Run the script with Python:

```bash
python3 indexer.py https://example.com --max-pages 5 --output index.json
```

Restrict crawling to the same domain as the input URL:

```bash
python3 indexer.py https://example.com --same-domain --max-pages 20
```

You can also index a local file or directory:

```bash
python3 indexer.py ./sample.txt
python3 indexer.py ./documents
```

## Options
| Flag | Default | Description |
|---|---|---|
| `--max-pages` | 10 | Maximum number of web pages to crawl |
| `--same-domain` | off | Only follow links within the same domain as the input URL |
| `--output` | `index.json` | Path for the output JSON file |

## Browser-based directory search
Open [index.html](index.html) in a browser (or serve the folder with `python3 -m http.server`) to search a local directory entirely client-side:

1. Click "Choose a directory to index" and select a folder — the browser prompts for directory access.
2. The page reads `.txt`, `.md`, `.py`, `.json`, `.csv` and `.html` files from that folder and builds a word-frequency index in memory.
3. Type a word or phrase in the search box to see matching files ranked by term frequency, with a highlighted snippet for each result.

No files are uploaded anywhere; indexing and searching happen entirely in the browser.

## Main file
- `indexer.py` - the crawler and indexing logic
- `index.html`, `app.js`, `styles.css` - the browser-based directory search UI

## Test the project
Run the repository-wide test suite from the project root:

```bash
./run_tests.sh
```

## Generate the report
Run the generator script to create a simple HTML artifact for this project:

```bash
python3 generate_report.py
```

This writes [generated_report.html](generated_report.html) in the same folder.
