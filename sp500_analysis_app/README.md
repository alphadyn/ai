# Market Lens

Market Lens is a dependency-free browser dashboard for screening a selected group of S&P 500 leaders. On every page load, it requests current quote and chart data from Nasdaq's public market endpoints, calculates a transparent rules-based score, and labels the strongest result as Buy, Hold, or Sell. Selecting a row loads the latest available financial statement rows for that company.

## Run locally

```bash
python3 server.py
```

Open `http://localhost:8000`. The local server proxies Nasdaq requests because Nasdaq's public API does not allow browser cross-origin requests. The GitHub Pages deployment publishes a fresh Nasdaq snapshot every 15 minutes; the refresh button reloads the latest published snapshot.

## Model notes

The score combines the available chart trend, recent momentum, position within the 52-week range, and daily move. It is a screening heuristic, not a valuation model, price target, or personalized investment recommendation. Nasdaq data can be delayed or unavailable due to provider limits, market closures, or browser network policy. Always verify quotes and filings before making decisions.
