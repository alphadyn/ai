# Market Lens

Market Lens is a dependency-free browser dashboard for screening a selected group of S&P 500 leaders. On every page load, it requests current quote and chart data from Nasdaq's public market endpoints, calculates a transparent rules-based score, and labels the strongest result as Buy, Hold, or Sell. Selecting a row loads the latest available financial statement rows for that company.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/sp500_analysis_app/` from the repository root, or run the server from this directory and open `http://localhost:8000`.

## Model notes

The score combines the available chart trend, recent momentum, position within the 52-week range, and daily move. It is a screening heuristic, not a valuation model, price target, or personalized investment recommendation. Nasdaq data can be delayed or unavailable due to provider limits, market closures, or browser network policy. Always verify quotes and filings before making decisions.
