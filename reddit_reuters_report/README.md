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

### If you see a "403 Blocked" error
Reddit aggressively blocks anonymous, non-browser requests from many networks — especially cloud,
hosting, and VPN IP ranges. If that happens, use Reddit's official OAuth API instead, which is rarely
blocked:

1. Create a free app at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) — choose type
   "installed app" or "script" and note the client ID shown under the app name (and the secret, if
   using a "script" app).
2. Set the credentials as environment variables before starting the server:

   ```bash
   export REDDIT_CLIENT_ID="your-client-id"
   export REDDIT_CLIENT_SECRET="your-client-secret"   # leave unset/empty for "installed app" apps
   python3 server.py
   ```

`server.py` automatically uses OAuth when `REDDIT_CLIENT_ID` is set, and falls back to the direct
request otherwise.

## Main files
- `server.py` — serves the static files and proxies `/api/reddit-front-page` to Reddit server-side
  (via OAuth when credentials are set, or a direct request otherwise)
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
