# Alphadyn AI Apps and Experiments

This repository is a portfolio-style collection of 35 independent projects: interactive demos, business mockups, data visualizations, browser apps, reports, and Python utilities. Each project is designed to be opened, adapted, or expanded on its own.

The root landing page in [index.html](index.html) links to the most relevant app directories and gives a quick overview of the portfolio. It includes a Featured area and a full Catalog of all available apps and experiments.

## Featured projects

The landing page highlights these projects:

1. [pulse](pulse/) — Social/news app with posts, tags, and threaded discussion
2. [market_curve_lab](market_curve_lab/) — S&P 500 rankings, performance, trendlines, and concavity
3. [experiences_app](experiences_app/) — Maps and authenticated trip journal
4. [market_lens_app](market_lens_app/) — Large-cap equity screening dashboard
5. [nexus](nexus/) — Content and media workspace
6. [online_store_app](online_store_app/) — Storefront and checkout experience
7. [photo_gallery_app](photo_gallery_app/) — Responsive photo gallery
8. [video_conference_app](video_conference_app/) — Meeting and communication interface

## Repository layout

### Web apps and interactive demos

- [market_curve_lab](market_curve_lab/) — Rank all 500 S&P 500 companies by market cap, search stocks, and inspect selected-ticker all-time performance, trendlines, and concavity.
- [architectural_design_app](architectural_design_app/) — Architectural concept board and home design presentation.
- [audio_equalizer_app](audio_equalizer_app/) — Browser media player with live waveform and spectrum analysis.
- [business_site](business_site/) — Marketing landing page for an AI company.
- [car_sketch_project](car_sketch_project/) — Image-to-car-sketch generator.
- [experiences_app](experiences_app/) — Experiences: a Supabase-backed journal with trips, shareable Experience collections, Event maps, precise location picking, and media carousels.
- [earth_3d_explorer](earth_3d_explorer/) — Three.js globe with overlays and inspection interactions.
- [ehr_web_app](ehr_web_app/) — Electronic health record demo interface.
- [enterprise_executive_dashboard](enterprise_executive_dashboard/) — Multi-page executive dashboard.
- [fractal_patterns_app](fractal_patterns_app/) — Interactive fractal visualizer.
- [game_videos_site](game_videos_site/) — Gaming video showcase page.
- [iphone_17_simulator](iphone_17_simulator/) — Interactive iPhone simulator experience.
- [iphone_duo_app](iphone_duo_app/) — Dual-device phone simulator with companion UI.
- [legal_docketing_app](legal_docketing_app/) — Matter and deadline tracking app.
- [multi_search_engine_app](multi_search_engine_app/) — Search comparison page across multiple engines.
- [nexus](nexus/) — Content and media management system with SQLite-backed local storage and server-side API.
- [online_store_app](online_store_app/) — Storefront mockup with catalog, cart, and checkout flow.
- [pencil_sketch_app](pencil_sketch_app/) — Image-to-pencil-sketch converter.
- [photo_gallery_app](photo_gallery_app/) — Responsive gallery app.
- [postboard_app](postboard_app/) — Personal post archive with rich text, uploads, and Supabase integration.
- [prime_counter_app](prime_counter_app/) — Prime counting utility with charting and timing.
- [pulse](pulse/) — Social/news-style app with posts, tags, and discussion flows.
- [resume](resume/) — Portfolio-style resume page.
- [market_lens_app](market_lens_app/) — Dashboard for screening and reviewing large-cap equities.
- [vcard_generator_app](vcard_generator_app/) — Card generation and QR code output.
- [video_conference_app](video_conference_app/) — Meeting interface with chat and file-sharing UX.

### Reports and presentation pages

- [business_plan](business_plan/) — Startup business plan presentation.
- [expense_report](expense_report/) — Corporate expense report mockup.
- [human_vs_ai_skills_report](human_vs_ai_skills_report/) — Comparison of human and AI capabilities.
- [index_fund_report](index_fund_report/) — Index fund overview and risk breakdown.
- [largest_companies_report](largest_companies_report/) — Large-company market cap summary.
- [top_20_occupations_income_report](top_20_occupations_income_report/) — Income report across top occupations.

### Python utilities and tooling

- [crawler_indexer](crawler_indexer/) — Domain-scoped crawler and indexer utility.
- [google_page_capture_app](google_page_capture_app/) — Local Flask web app that captures Google News headlines and related stories, displays them in a browser, and downloads the results as JSON.
- [secure_file_tool](secure_file_tool/) — Encryption and decryption utility with CLI and GUI options.

## Quick start

Most projects are static sites and can be opened directly in a browser. A simple local server is the safest way to run them consistently:

```bash
cd project_folder
python3 -m http.server 8000
```

Then visit http://localhost:8000.

Examples:

```bash
cd audio_equalizer_app
python3 -m http.server 8000

cd earth_3d_explorer
python3 -m http.server 8000

cd iphone_17_simulator
python3 -m http.server 8000

cd online_store_app
python3 -m http.server 8000

cd market_lens_app
python3 -m http.server 8000
```

### Nexus server

The [nexus](nexus/) app includes an SQLite-backed backend:

```bash
cd nexus
python3 server.py --port 8000
```

Then open the app from the local server or direct to the generated HTML entrypoint as applicable to the project.

### Market Curve Lab

The [market_curve_lab](market_curve_lab/) web app builds a market-cap ranking of all 500 S&P 500 companies and lets you search any listed equity by ticker or company name. It computes adjusted all-time performance, linear and quadratic trendlines, and recent concavity for the selected ticker; histories are fetched on demand instead of requesting all 500 at startup. Start it with:

```bash
cd market_curve_lab
python3 -m pip install -r requirements.txt
python3 app.py
```

Open <http://127.0.0.1:5001>, type a ticker or company name, and choose a matching stock. The complete S&P 500 is listed in market-cap order; ranking data is cached for six hours, and selected-ticker histories for one hour. The dashboard shows the closest-fitting model by R² and classifies recent performance curvature as concave up or down.

### Postboard setup

The [postboard_app](postboard_app/) project uses Supabase for persistence and API access. Configure it once:

1. Create a Supabase project.
2. In the SQL editor, run [postboard_app/supabase-schema.sql](postboard_app/supabase-schema.sql).
3. Copy [postboard_app/supabase-config.js](postboard_app/supabase-config.js) and replace the placeholder URL and anon key with your project values.
4. Serve the folder locally or deploy it to GitHub Pages.

If the app reports a `NetworkError`, the config file still contains placeholder values, or the Supabase URL is unreachable, re-check the project settings and the generated config file.

### Python utilities

Run utility scripts from the repo root or from the project folder as needed:

```bash
python3 crawler_indexer/indexer.py https://example.com --same-domain --max-pages 5 --output index.json
python3 -m pip install -r google_page_capture_app/requirements.txt
python3 -m playwright install chromium
python3 google_page_capture_app/app.py
python3 secure_file_tool/file_crypto.py encrypt /path/to/input.txt /path/to/output.bin --password "your-strong-password"
python3 secure_file_tool/gui_app.py
```

The Google News Capture app runs as a local web app. After starting it, open <http://127.0.0.1:5000> to capture and view headlines, then download the structured JSON results.

## Testing

This repo includes automated tests for the crawler and security utility tooling. Install the dev dependencies and run the suite:

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m pytest
```

A convenience wrapper is also included:

```bash
./run_tests.sh
```

The pytest configuration is defined in [pytest.ini](pytest.ini).

## Notes

- This is a collection of independent experiments rather than a single monolithic product.
- Each project is self-contained and can be reused, adapted, or repurposed.
- The root [index.html](index.html) provides a gallery-style landing page for the repo.

## License

The code in this repository is licensed under the GNU General Public License, version 3 or any later version (GPL-3.0-or-later). See [LICENSE](LICENSE) for the full terms.

Third-party dependencies, services, and assets remain subject to their own licenses and terms.

## Generation scripts

Most project folders include a lightweight `generate_report.py` or similar script that produces demo artifacts such as `generated_report.html` when run with Python 3.
