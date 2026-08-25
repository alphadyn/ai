# Reddit Front Page, Reuters-Style

A browser-based app that downloads the top 100 posts from Reddit's front page and displays them
laid out like the Reuters.com homepage — a lead story, a story grid, and a scrolling headline list.
Every page load fetches fresh data from Reddit, so the sources and articles change each time you refresh.

## What it does
- Fetches `https://www.reddit.com/.json?limit=100` directly from the browser on every page load (no caching)
- Picks the top post as the lead story with a large image and 4 supporting side stories
- Renders the next 9 posts as a Reuters-style story grid
- Lists the remaining posts as a scrolling headline list with subreddit and relative timestamp
- Builds a top navigation bar from the subreddits present in the current batch of posts

## Run it
Reddit's API requires the page to be served over `http(s)://`, not opened directly as a `file://` URL,
for the browser to allow the cross-origin request. From this folder, run:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser. Refresh the page to pull a new
set of articles.

## Main files
- `index.html` — page structure (masthead, hero, story grid, headline list)
- `app.js` — fetches Reddit's front page JSON and renders it into the Reuters-style layout
- `styles.css` — Reuters-inspired styling (serif headlines, orange wordmark, grid layout)

## Notes
- Not affiliated with Reuters or Reddit; this is a styling exercise using publicly available Reddit data.
- If Reddit rate-limits or blocks the request, the page shows an error message and you can refresh to retry.

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
