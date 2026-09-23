# Market Lens

Market Lens is a dependency-free browser dashboard for screening the entire S&P 500 index. On every page load, it fetches the current index constituent list, then requests quote and chart data for every constituent from Nasdaq's public market endpoints, calculates a transparent rules-based score for each, and labels each result as Buy, Hold, or Sell. The ranked watchlist table shows only the top 20 highest-conviction results per signal (Buy/Hold/Sell); the summary cards always reflect the single strongest result across the full scan. Selecting a row loads the latest available financial statement rows for that company.

Scanning the full index means roughly 1,000 Nasdaq requests per scan, so a full refresh can take several minutes; the status line and "scanned / shown" count reflect progress. If the live constituent list can't be fetched (offline, blocked, etc.), the app falls back to a smaller hardcoded watchlist.

## Run locally

```bash
python3 server.py
```

Open `http://localhost:8000`. The local server proxies Nasdaq requests because Nasdaq's public API does not allow browser cross-origin requests. The dashboard does not fall back to deployment snapshots; deploy this directory as a Vercel project with `sp500_analysis_app` as the project root for request-time live data. The `api/[...path].js` function provides the same-origin Nasdaq proxy used by the dashboard.

The Vercel deployment can be connected directly to the GitHub repository. Once deployed, the dashboard refresh button requests current quote, chart, and financial data through the Vercel API function instead of waiting for a Pages snapshot.

## Model notes

The score combines the available chart trend, recent momentum, position within the 52-week range, and daily move. It is a screening heuristic, not a valuation model, price target, or personalized investment recommendation. Nasdaq data can be delayed or unavailable due to provider limits, market closures, or browser network policy. Always verify quotes and filings before making decisions.
