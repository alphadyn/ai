# AI Projects Repository

This repository is a collection of standalone demos, prototypes, and utility projects spanning AI, web development, finance, legal technology, and content showcases.

## Featured projects

- [business_site](business_site/) - A polished single-page marketing website for an AI company.
- [business_plan](business_plan/) - A startup business plan presentation for an AI-focused venture.
- [car_sketch_project](car_sketch_project/) - Convert car photos to professional pencil sketch artwork using advanced computer vision techniques.
- [crawler_indexer](crawler_indexer/) - A Python-based web crawler and indexer with domain-scoped crawling and duplicate-page filtering.
- [pencil_sketch_app](pencil_sketch_app/) - A browser app that lets users upload an image and generate black-and-white or color pencil sketches with adjustable accuracy, pencil stroke length, brightness, and RGB color filters.
- [ehr_web_app](ehr_web_app/) - A polished single-page electronic health record web app with patient search, vitals, medications, appointments, and encounter documentation.
- [expense_report](expense_report/) - A professional HTML expense report template with polished corporate styling.
- [fractal_patterns_app](fractal_patterns_app/) - A browser-based fractal visualizer that generates 10 classic fractal patterns on an interactive canvas.
- [game_videos_site](game_videos_site/) - A simple website that showcases gaming video links.
- [human_vs_ai_skills_report](human_vs_ai_skills_report/) - A report comparing human and AI capabilities.
- [index_fund_report](index_fund_report/) - An index fund overview grouped by risk profile.
- [largest_companies_report](largest_companies_report/) - A polished report of 100 of the world’s largest public companies with market-cap and website details.
- [legal_docketing_app](legal_docketing_app/) - A fully functional legal docketing web app for tracking matters, deadlines, and tasks.
- [prime_numbers](prime_numbers/) - A small Python utility for finding and analyzing prime numbers.
- [top_20_occupations_income_report](top_20_occupations_income_report/) - A polished report of 20 occupations with the highest approximate median incomes.
- [resume](resume/) - A polished HTML resume for an AI software engineer.
- [secure_file_tool](secure_file_tool/) - A file encryption utility with command-line and GUI interfaces.
- [sp500_quarterly_returns](sp500_quarterly_returns/) - A simple report highlighting strong S&P 500 quarterly performers.

## How to use

Most of the web-based projects are static HTML, CSS, and JavaScript files that can be opened directly in a browser. Report folders such as [largest_companies_report](largest_companies_report/) and [top_20_occupations_income_report](top_20_occupations_income_report/) can also be viewed by opening their index.html files.

For the expense report, fractal app, and other static pages, simply open the relevant HTML file in your browser.

For the legal docketing app, run a local server from the project folder:

```bash
cd legal_docketing_app
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

For the Python projects, run them from their respective folders with Python 3.

Example:

```bash
python3 crawler_indexer/indexer.py https://example.com --same-domain --max-pages 5 --output index.json
python3 prime_numbers/prime_finder.py
```

## Notes

This repository is intended as a collection of sample projects and demos rather than a single production application. Each folder can be adapted and expanded independently.

## Automated tests

The repository now includes unit tests for the crawler indexer and the secure file tool. Install the test dependency and run the suite from the repository root:

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m pytest
```

The pytest configuration is stored in [pytest.ini](pytest.ini).

## Generation scripts

Most project folders include a lightweight generator script named generate_report.py, which creates a simple HTML artifact named generated_report.html when run with Python 3.
