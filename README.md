# AI Projects Repository

This repository is a collection of standalone demos, prototypes, and utility projects spanning AI, web development, finance, legal technology, and content showcases.

## Featured projects

- [business_site](business_site/) - A polished single-page marketing website for an AI company.
- [business_plan](business_plan/) - A startup business plan presentation for an AI-focused venture.
- [crawler_indexer](crawler_indexer/) - A Python-based crawler and indexer for web content.
- [game_videos_site](game_videos_site/) - A simple website that showcases gaming video links.
- [human_vs_ai_skills_report](human_vs_ai_skills_report/) - A report comparing human and AI capabilities.
- [index_fund_report](index_fund_report/) - An index fund overview grouped by risk profile.
- [legal_docketing_app](legal_docketing_app/) - A fully functional legal docketing web app for tracking matters, deadlines, and tasks.
- [prime_numbers](prime_numbers/) - A small Python utility for finding and analyzing prime numbers.
- [resume](resume/) - A polished HTML resume for an AI software engineer.
- [secure_file_tool](secure_file_tool/) - A file encryption utility with command-line and GUI interfaces.
- [sp500_quarterly_returns](sp500_quarterly_returns/) - A simple report highlighting strong S&P 500 quarterly performers.

## How to use

Most of the web-based projects are static HTML, CSS, and JavaScript files that can be opened directly in a browser.

For the legal docketing app, run a local server from the project folder:

```bash
cd legal_docketing_app
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

For the Python projects, run them from their respective folders with Python 3.

Example:

```bash
python3 crawler_indexer/indexer.py https://example.com --max-pages 5 --output index.json
python3 prime_numbers/prime_finder.py
```

## Notes

This repository is intended as a collection of sample projects and demos rather than a single production application. Each folder can be adapted and expanded independently.
