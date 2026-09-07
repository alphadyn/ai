# AI Projects Repository

This repository contains a collection of small web apps, reports, demos, and utility scripts built for experimentation, portfolio work, and technical prototyping. The projects span marketing sites, dashboards, data visualizations, legal tooling, browser utilities, and Python-based automation.

## Repository layout

### Web apps and interactive demos

- [Business Site](business_site/) - Marketing landing page for an AI company.
- [Audio Equalizer](audio_equalizer_app/) - Browser-based media player with live frequency spectrum and waveform analysis.
- [S&P 500 Analysis](sp500_analysis_app/) - Refreshable S&P 500 watchlist with transparent Buy, Hold, and Sell screening signals.
- [Business Plan](business_plan/) - Presentation-style startup business plan.
- [Car Sketch Project](car_sketch_project/) - Generates stylized car sketches from uploaded images.
- [Check-in Map](checkin_map_app/) - Map-based location check-in app with a recent-history log.
- [3D Earth Explorer](earth_3d_explorer/) - Three.js globe with country overlays and point inspection.
- [EHR Web App](ehr_web_app/) - Electronic health record demo interface.
- [Executive Dashboard](enterprise_executive_dashboard/) - Multi-page company dashboard for operations and strategy reporting.
- [Fractal Patterns](fractal_patterns_app/) - Interactive fractal visualizer.
- [Game Videos](game_videos_site/) - Simple gaming video showcase page.
- [Legal Docketing](legal_docketing_app/) - Legal matter and deadline tracking app.
- [Pencil Sketch](pencil_sketch_app/) - Image-to-pencil-sketch converter with adjustable controls.
- [Photo Gallery](photo_gallery_app/) - Responsive photo gallery with random image loading.
- [Prime Counter](prime_counter_app/) - Prime counting utility with timing and charting.
- [Resume](resume/) - HTML resume for an AI-focused software engineer.
- [vCard Generator](vcard_generator_app/) - Generates downloadable contact cards and QR codes.

### Reports and presentation pages

- [Expense Report](expense_report/) - Corporate-style expense report mockup.
- [Human vs. AI Skills](human_vs_ai_skills_report/) - Comparison report on human vs. AI capabilities.
- [Index Fund Report](index_fund_report/) - Index fund overview and risk breakdown.
- [Largest Companies Report](largest_companies_report/) - Report of large public companies and market cap metrics.
- [S&P 500 Quarterly Returns](sp500_quarterly_returns/) - Quarterly return highlights for S&P 500 companies.
- [Top 20 Occupations Income](top_20_occupations_income_report/) - Income report for top occupations.

### Python utilities and tooling

- [Crawler Indexer](crawler_indexer/) - Domain-scoped crawler and indexer with duplicate filtering.
- [Secure File Tool](secure_file_tool/) - Encryption utility with CLI and GUI access.

## Quick start

Most web-based projects are static pages that can be opened directly in a browser. For apps that rely on a local web server, run a simple Python HTTP server in the project folder:

```bash
cd legal_docketing_app
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.

The same pattern works for projects like:

```bash
cd audio_equalizer_app
python3 -m http.server 8000

cd sp500_analysis_app
python3 -m http.server 8000

cd enterprise_executive_dashboard
python3 -m http.server 8000

cd earth_3d_explorer
python3 -m http.server 8000

cd vcard_generator_app
python3 -m http.server 8000
```

For Python code, run the script from the repo root or from its project folder as needed:

```bash
python3 crawler_indexer/indexer.py https://example.com --same-domain --max-pages 5 --output index.json
python3 secure_file_tool/file_crypto.py encrypt /path/to/input.txt /path/to/output.bin --password "your-strong-password"
python3 secure_file_tool/gui_app.py
```

## Testing

The repository includes automated tests for the crawler and secure file tools. To install the test dependencies and run the suite:

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m pytest
```

A convenience wrapper is also included:

```bash
./run_tests.sh
```

The pytest configuration lives in [pytest.ini](pytest.ini).

## Notes

This repository is designed as a collection of independent sample projects rather than a single monolithic application. Each project is self-contained and can be reused, adapted, or expanded on its own.

## Generation scripts

Most project directories include a lightweight `generate_report.py` script that produces a simple HTML artifact such as `generated_report.html` when run with Python 3.
