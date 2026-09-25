# Market Curve Lab

A web app that loads all 500 members of the current S&P 500 index, ranks them by market capitalization, and lets you search for any other listed equity by ticker or company name. Market caps come from Nasdaq's paginated public screener joined to the current S&P constituent list. Multiple share classes are combined by issuer and represented by the class with the largest reported market cap. If market cap is unavailable, the member remains in the list at the bottom; Brown–Forman currently has no screener value. Search results and adjusted monthly price history come from Yahoo Finance.

For the selected company, the app plots split- and dividend-adjusted total performance from a $100 starting value, overlays linear and quadratic least-squares trendlines, compares model fit using R², and reports recent concavity based on a quadratic fit to the latest 24 monthly observations. The full S&P 500 is ranked when the app loads; historical prices and curve analysis are fetched only for the selected ticker.

## Run locally

Requires Python 3.9+ and an internet connection.

```sh
python3 -m pip install -r requirements.txt
python3 app.py
```

Open <http://127.0.0.1:5001>. On a cold start, the app pages through Nasdaq's screener to build the complete S&P 500 ranking; it caches that list for six hours. Then type a ticker or company name and choose a matching listed stock. S&P 500 members are labeled with their market-cap rank. Searches are cached for two minutes, and selected-ticker price analyses for one hour. The legend controls toggle each chart series.

## Deploying so the GitHub Pages copy works

`index.html` here is the real app (same markup the Flask `app.py` renders locally), not a placeholder. It calls a JSON API for company rankings, search, and price history — Nasdaq and Yahoo Finance don't allow browser cross-origin requests, so those calls can't be made directly from a static GitHub Pages site. `app.py` provides that API for local use; [`api/`](api/) provides the same three endpoints (`/api/companies`, `/api/search`, `/api/analysis`) as Vercel serverless functions, matching the pattern used by [`market_lens_app`](../market_lens_app).

To make the hosted (`github.io`) copy live:

1. Deploy this directory (`market_curve_lab`) as its own Vercel project — no build step or config needed, Vercel auto-detects the `api/` functions.
2. Note the deployment's `*.vercel.app` URL.
3. In [`static/app.js`](static/app.js), update the `VERCEL_API` constant to `https://<your-project>.vercel.app/api`.

`app.js` already switches to `VERCEL_API` whenever the page is served from a `github.io` host, and uses same-origin `/api` otherwise (local Flask dev or the Vercel deployment itself).

## Method

- **Performance:** Yahoo Finance adjusted monthly close, rebased to $100 at the first available observation. The chart uses a logarithmic vertical scale so the full history remains readable.
- **Trendlines:** Linear and quadratic ordinary least-squares fits are calculated over log-transformed monthly performance, matching the chart's logarithmic vertical scale. The model with higher R² is identified as the closest-fitting full-period trendline.
- **Current concavity:** A quadratic least-squares fit over the latest 24 monthly observations is concave up when its second-order coefficient is positive and concave down when negative. This describes recent historical curvature; it is not a forecast.

The company list is joined to Nasdaq's paginated market-cap screener; market caps are indicative and can be delayed or unavailable. Company price histories are fetched on selection rather than issuing hundreds of historical-price requests at startup. This educational visualization is not investment advice. Historical data can be revised or unavailable, and provider endpoints can change.

## Brand assets

The app's SVG wordmark ([market-curve-logo.svg](static/market-curve-logo.svg)), chart mark ([market-curve-mark.svg](static/market-curve-mark.svg)), and browser favicon ([favicon.svg](static/favicon.svg)) are in [static](static/).
