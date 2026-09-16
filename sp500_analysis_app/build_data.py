"""Create a static market-data snapshot for GitHub Pages deployments."""

from pathlib import Path
from urllib.request import Request, urlopen
from datetime import datetime, timezone
import json


API = "https://api.nasdaq.com/api"
WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'AVGO', 'JPM', 'LLY', 'V', 'XOM', 'COST', 'WMT', 'ORCL', 'NFLX', 'AMD']
OUTPUT = Path(__file__).with_name("market_data.json")


def fetch(path):
    request = Request(
        f"{API}{path}",
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Market Lens deploy snapshot)",
            "Referer": "https://www.nasdaq.com/",
        },
    )
    with urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if not payload.get("data"):
        raise RuntimeError(f"No data returned for {path}")
    return payload["data"]


def main():
    quotes = []
    for symbol in WATCHLIST:
        quotes.append({
            "symbol": symbol,
            "info": fetch(f"/quote/{symbol}/info?assetclass=stocks"),
            "chart": fetch(f"/quote/{symbol}/chart?assetclass=stocks"),
        })
    OUTPUT.write_text(json.dumps({"generatedAt": datetime.now(timezone.utc).isoformat(), "quotes": quotes}), encoding="utf-8")


if __name__ == "__main__":
    main()