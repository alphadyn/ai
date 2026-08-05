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

## Main file
- `indexer.py` - the crawler and indexing logic

## Generate the report
Run the generator script to create a simple HTML artifact for this project:

```bash
python3 generate_report.py
```

This writes [generated_report.html](generated_report.html) in the same folder.
