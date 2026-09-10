# Multi-Search Engine Web App

A web application that takes a word or phrase as input, queries across up to 5 search engines, and produces a report with exact one-line findings: `[Source] Matching Text — Link` (up to 10 results per search engine).

## Features

- **Input Word or Phrase**: Search any term, topic, or keyword with instant multi-engine querying and suggestion chips.
- **Up to 5 Search Engines**: Select up to 5 search engines from supported providers:
  - Google
  - Bing
  - DuckDuckGo
  - Yahoo
  - Wikipedia
  - Brave
  - arXiv (Scholarly)
  - Ecosia
- **Up to 10 Results per Search Engine**: Returns up to 10 ranked findings per engine (e.g. 50 total results across 5 engines).
- **Linked Summary Format**: Every finding is formatted with its summary directly hyperlinking to the search result destination:
  ```text
  [Source] [Summary](destination_link)
  ```
  Example:
  ```text
  [Google] [OpenAI introduces new reasoning neural network models: Comprehensive overview of recent architectures](https://www.google.com/search?q=ai)
  [DuckDuckGo] [Artificial Intelligence: Overview, Algorithms, and History: Foundational principles and modern applications](https://duckduckgo.com/?q=ai)
  [Wikipedia] [Artificial intelligence: Wikipedia encyclopedic article summary](https://en.wikipedia.org/wiki/Artificial_intelligence)
  ```
- **Export & Copy**:
  - One-click copy for the entire raw one-line report
  - Download formatted `.txt` report
  - Download formatted `.md` (Markdown) report
  - Download `.json` structured data
- **Interactive UI**:
  - Live query highlighting
  - Multi-tab view: Interactive Stream, Exact One-Line Text, Grouped by Engine
  - Real-time in-report search filter
  - Dark / Light mode toggle

## Quick Start

### 1. Run with Python HTTP Server / API Backend (Recommended)

Run the included server in `multi_search_engine_app/`:

```bash
cd multi_search_engine_app
python3 server.py
```

Then open `http://localhost:8000` in your web browser.

### 2. Run as a Static Web App

You can also run any static web server:

```bash
cd multi_search_engine_app
python3 -m http.server 8000
```
Or open [index.html](index.html) directly in any modern browser.

### 3. Command Line Interface (CLI)

You can also run searches and generate reports directly from the terminal using [search_engine.py](search_engine.py):

```bash
python3 search_engine.py "artificial intelligence" --engines google bing duckduckgo yahoo wikipedia --max-results 10
```

Print raw one-line results only:
```bash
python3 search_engine.py "quantum computing" --format oneline
```

Output JSON format:
```bash
python3 search_engine.py "machine learning" --format json
```

## Running Tests

Run the test suite using pytest or unittest:

```bash
python3 -m unittest multi_search_engine_app/test_search_engine.py
```
Or from the root directory:
```bash
pytest multi_search_engine_app/test_search_engine.py
```
