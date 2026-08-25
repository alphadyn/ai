# Reddit Front Page, Reuters-Style

A browser-based app that downloads the top 100 posts from Reddit's front page and displays them
laid out like the Reuters.com homepage — a lead story, a story grid, and a scrolling headline list.
Every page load fetches fresh data from Reddit, so the sources and articles change each time you refresh.

## What it does
- A small local server (`server.py`) fetches `https://www.reddit.com/.json?limit=100` server-side on
  every request and serves the static site, so the browser only ever calls the same-origin
  `/api/reddit-front-page` endpoint — no browser CORS issues and no third-party proxies involved
- Picks the top post as the lead story with a large image and 4 supporting side stories
- Renders the next 9 posts as a Reuters-style story grid
- Lists the remaining posts as a scrolling headline list with subreddit and relative timestamp
- Builds a top navigation bar from the subreddits present in the current batch of posts

## Run it
Reddit blocks most direct cross-origin browser requests, so this app ships with a tiny
stdlib-only Python server that proxies the Reddit request from the server side. From this folder, run:

```bash
python3 server.py
```

Then open [http://localhost:8000](http://localhost:8000) in a browser. Refresh the page to pull a new
set of articles.

## Main files
- `server.py` — serves the static files and proxies `/api/reddit-front-page` to Reddit server-side
- `index.html` — page structure (masthead, hero, story grid, headline list)
- `app.js` — fetches the front page JSON from the local server and renders it into the Reuters-style layout
- `styles.css` — Reuters-inspired styling (serif headlines, orange wordmark, grid layout)

## Notes
- Not affiliated with Reuters or Reddit; this is a styling exercise using publicly available Reddit data.
- If Reddit rate-limits or blocks the server-side request, the page shows an error message and you can refresh to retry.

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
