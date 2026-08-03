# Crawler Indexer

This folder contains a small Python script that can index content from a URL, a local file, or a local directory.

## What it does
- Crawls web pages from a starting URL
- Extracts visible text from HTML
- Builds a simple word frequency index
- Saves the result as JSON to a chosen output file

## Usage
Run the script with Python:

```bash
python3 indexer.py https://example.com --max-pages 5 --output index.json
```

You can also index a local file or directory:

```bash
python3 indexer.py ./sample.txt
python3 indexer.py ./documents
```

## Main file
- `indexer.py` - the crawler and indexing logic

## Generate the report
Run the generator script to create a simple HTML artifact for this project:

```bash
python3 generate_report.py
```

This writes [generated_report.html](generated_report.html) in the same folder.
