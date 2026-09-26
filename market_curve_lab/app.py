#!/usr/bin/env python3
"""Local web app for long-run stock trend and concavity analysis."""

from __future__ import annotations

import csv
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import io
import json
import math
import re
import threading
import time
from typing import Any, Dict, List, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import quote, urlencode

from flask import Flask, jsonify, render_template, request

NASDAQ_API = "https://api.nasdaq.com/api"
SP500_URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
SCREENER_URL = f"{NASDAQ_API}/screener/stocks"
HISTORY_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{}"
HISTORY_START = int(datetime(1980, 1, 1, tzinfo=timezone.utc).timestamp())
CACHE_SECONDS = 60 * 60
COMPANY_CACHE_SECONDS = 6 * 60 * 60
SEARCH_CACHE_SECONDS = 2 * 60
SCREENER_LIMIT = 500
SP500_COMPANY_COUNT = 500
RECENT_WINDOW_MONTHS = 24
app = Flask(__name__)
_cache_lock = threading.Lock()
_analysis_cache: Dict[str, Dict[str, Any]] = {}
_company_cache: Dict[str, Any] = {"expires_at": 0.0, "companies": None}
_search_cache: Dict[str, Dict[str, Any]] = {}


def _request_json(url: str) -> Dict[str, Any]:
    """Fetch JSON from a public market-data endpoint with browser-like headers."""
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; TrendLab/1.0)",
            "Accept": "application/json, text/csv, */*",
            "Origin": "https://www.nasdaq.com",
            "Referer": "https://www.nasdaq.com/",
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper().replace(".", "-").replace("/", "-")


def _normalize_issuer_name(name: str) -> str:
    name = re.sub(r"\s*\((?:class|series)\s+[^)]*\)", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s+(?:class|series)\s+[A-Z0-9]+$", "", name, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", name).strip()


def _normalize_ticker(symbol: str) -> str:
    """Validate a Yahoo Finance ticker without changing its provider-specific syntax."""
    ticker = symbol.strip().upper()
    if not re.fullmatch(r"[A-Z0-9^][A-Z0-9.^=_-]{0,19}", ticker):
        raise ValueError("Enter a valid stock ticker.")
    return ticker


def search_securities(query: str) -> List[Dict[str, Any]]:
    """Search Yahoo Finance for matching listed equities, including non-index stocks."""
    query = query.strip()
    if len(query) < 1:
        return []
    if len(query) > 60:
        raise ValueError("Search text must be 60 characters or fewer.")

    cache_key = query.casefold()
    now = time.time()
    with _cache_lock:
        cached = _search_cache.get(cache_key)
        if cached and now < cached["expires_at"]:
            return cached["results"]

    params = urlencode({"q": query, "quotesCount": 12, "newsCount": 0})
    try:
        response = _request_json(f"https://query1.finance.yahoo.com/v1/finance/search?{params}")
    except (HTTPError, URLError, TimeoutError) as error:
        raise RuntimeError("Could not search Yahoo Finance. Check the server's internet connection.") from error

    matches = []
    seen_symbols = set()
    for quote_result in response.get("quotes", []):
        symbol = str(quote_result.get("symbol") or "").strip().upper()
        if quote_result.get("quoteType") != "EQUITY" or not symbol or symbol in seen_symbols:
            continue
        seen_symbols.add(symbol)
        matches.append({
            "symbol": symbol,
            "company": quote_result.get("shortname") or quote_result.get("longname") or symbol,
            "exchange": quote_result.get("exchDisp") or quote_result.get("exchange") or "",
            "market_cap": quote_result.get("marketCap"),
            "quote_type": "EQUITY",
        })

    with _cache_lock:
        _search_cache[cache_key] = {"results": matches, "expires_at": time.time() + SEARCH_CACHE_SECONDS}
    return matches


def fetch_sp500_companies(force_refresh: bool = False) -> List[Dict[str, Any]]:
    """Rank all current S&P 500 issuers by market cap, including unknown-cap members last."""
    now = time.time()
    with _cache_lock:
        if not force_refresh and _company_cache["companies"] and now < _company_cache["expires_at"]:
            return _company_cache["companies"]

    try:
        constituents_csv = urlopen(SP500_URL, timeout=30).read().decode("utf-8")
        members = {
            _normalize_symbol(row["Symbol"]): row["Security"].strip()
            for row in csv.DictReader(io.StringIO(constituents_csv))
        }
    except (HTTPError, URLError, TimeoutError, KeyError, UnicodeDecodeError) as error:
        raise RuntimeError("Could not load the current S&P 500 constituent list.") from error

    issuers: Dict[str, Dict[str, Any]] = {}
    issuer_by_symbol: Dict[str, str] = {}
    for symbol, security_name in members.items():
        issuer_name = _normalize_issuer_name(security_name)
        issuer_key = issuer_name.casefold()
        issuer_by_symbol[symbol] = issuer_key
        issuers.setdefault(issuer_key, {
            "company": issuer_name,
            "symbol": symbol,
            "market_cap": None,
            "representative_market_cap": None,
        })

    found_symbols = set()

    def fetch_screener_page(offset: int) -> Dict[str, Any]:
        query = urlencode({
            "tableonly": "true",
            "limit": str(SCREENER_LIMIT),
            "offset": str(offset),
            "exchange": "all",
            "sortColumn": "marketCap",
            "sortOrder": "DESC",
        })
        return _request_json(f"{SCREENER_URL}?{query}")

    def collect_rows(rows: List[Dict[str, Any]]) -> None:
        for row in rows:
            symbol = _normalize_symbol(str(row.get("symbol") or ""))
            issuer_key = issuer_by_symbol.get(symbol)
            if not issuer_key:
                continue
            found_symbols.add(symbol)
            market_cap_text = str(row.get("marketCap") or "").replace(",", "")
            try:
                market_cap = float(market_cap_text)
            except ValueError:
                continue
            if market_cap <= 0:
                continue

            issuer = issuers[issuer_key]
            representative_market_cap = issuer["representative_market_cap"]
            if representative_market_cap is None or market_cap > representative_market_cap:
                issuer["symbol"] = symbol
                issuer["market_cap"] = market_cap
                issuer["representative_market_cap"] = market_cap

    try:
        first_page = fetch_screener_page(0).get("data", {})
        first_rows = first_page.get("table", {}).get("rows", [])
        total_records = int(first_page.get("totalrecords") or len(first_rows))
        collect_rows(first_rows)

        remaining_offsets = list(range(SCREENER_LIMIT, total_records, SCREENER_LIMIT))
        with ThreadPoolExecutor(max_workers=4) as executor:
            for start in range(0, len(remaining_offsets), 4):
                offsets = remaining_offsets[start:start + 4]
                pages = list(executor.map(fetch_screener_page, offsets))
                for page in pages:
                    collect_rows(page.get("data", {}).get("table", {}).get("rows", []))
                if found_symbols.issuperset(members):
                    break
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError):
        # Graceful fallback: continue with the S&P 500 constituent list and unknown market caps.
        # This keeps the app usable when Nasdaq's screener temporarily blocks or rate-limits requests.
        pass

    companies = sorted(
        issuers.values(),
        key=lambda item: (item["market_cap"] is not None, item["market_cap"] or 0),
        reverse=True,
    )
    if len(companies) < SP500_COMPANY_COUNT:
        raise RuntimeError(f"Only {len(companies)} distinct S&P 500 companies were found; 500 are required.")
    companies = companies[:SP500_COMPANY_COUNT]
    for rank, company in enumerate(companies, start=1):
        company["rank"] = rank
        company.pop("representative_market_cap", None)

    with _cache_lock:
        _company_cache.update(companies=companies, expires_at=time.time() + COMPANY_CACHE_SECONDS)
    return companies


def _solve(matrix: List[List[float]], vector: List[float]) -> List[float]:
    """Solve a small linear system using partial-pivot Gaussian elimination."""
    size = len(vector)
    rows = [matrix[index][:] + [vector[index]] for index in range(size)]
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(rows[row][column]))
        if abs(rows[pivot][column]) < 1e-12:
            raise ValueError("Price history is insufficient to fit a trendline.")
        rows[column], rows[pivot] = rows[pivot], rows[column]
        divisor = rows[column][column]
        rows[column] = [value / divisor for value in rows[column]]
        for row in range(size):
            if row == column:
                continue
            factor = rows[row][column]
            rows[row] = [
                value - factor * pivot_value
                for value, pivot_value in zip(rows[row], rows[column])
            ]
    return [rows[index][-1] for index in range(size)]


def fit_polynomial(values: List[float], degree: int) -> Tuple[List[float], float]:
    """Return least-squares polynomial coefficients and R-squared for indexed samples."""
    if degree not in (1, 2) or len(values) < degree + 1:
        raise ValueError("A linear or quadratic fit needs more observations.")

    count = len(values)
    xs = [-1.0 + 2.0 * index / (count - 1) for index in range(count)]
    powers = [sum(x ** power for x in xs) for power in range(degree * 2 + 1)]
    matrix = [[powers[row + column] for column in range(degree + 1)] for row in range(degree + 1)]
    vector = [sum((x ** power) * y for x, y in zip(xs, values)) for power in range(degree + 1)]
    coefficients = _solve(matrix, vector)
    predicted = [sum(coefficient * x ** power for power, coefficient in enumerate(coefficients)) for x in xs]
    residual_sum = sum((actual - estimate) ** 2 for actual, estimate in zip(values, predicted))
    mean = sum(values) / count
    total_sum = sum((actual - mean) ** 2 for actual in values)
    r_squared = 1.0 if total_sum == 0 else 1.0 - residual_sum / total_sum
    return coefficients, r_squared


def build_analysis(payload: Dict[str, Any], symbol: str = "AAPL") -> Dict[str, Any]:
    """Normalize chart data and calculate full-history fits and recent curvature."""
    chart = payload.get("chart", {})
    if chart.get("error"):
        error = chart["error"]
        raise RuntimeError(error.get("description") or "Yahoo Finance returned a data error.")
    results = chart.get("result") or []
    if not results:
        raise RuntimeError(f"No {symbol} price history was returned by the data provider.")

    result = results[0]
    timestamps = result.get("timestamp") or []
    indicators = result.get("indicators") or {}
    quote = (indicators.get("quote") or [{}])[0]
    close_values = quote.get("close") or []
    adjusted_values = (indicators.get("adjclose") or [{}])[0].get("adjclose") or close_values
    points = []
    for timestamp, close in zip(timestamps, adjusted_values):
        if close is None or not math.isfinite(float(close)) or float(close) <= 0:
            continue
        points.append({
            "date": datetime.fromtimestamp(timestamp, timezone.utc).strftime("%Y-%m-%d"),
            "adjusted_close": float(close),
        })
    if len(points) < 5:
        raise RuntimeError("Not enough valid historical observations to calculate trendlines.")

    first_price = points[0]["adjusted_close"]
    performance = [point["adjusted_close"] / first_price * 100.0 for point in points]
    log_performance = [math.log10(value) for value in performance]
    linear_coefficients, linear_r2 = fit_polynomial(log_performance, 1)
    quadratic_coefficients, quadratic_r2 = fit_polynomial(log_performance, 2)
    recent_values = log_performance[-min(RECENT_WINDOW_MONTHS, len(log_performance)):]
    recent_coefficients, _ = fit_polynomial(recent_values, 2)
    concavity = "concave up" if recent_coefficients[2] >= 0 else "concave down"

    for index, point in enumerate(points):
        x = -1.0 + 2.0 * index / (len(points) - 1)
        point["performance"] = performance[index]
        linear_log_fit = sum(coefficient * x ** power for power, coefficient in enumerate(linear_coefficients))
        quadratic_log_fit = sum(coefficient * x ** power for power, coefficient in enumerate(quadratic_coefficients))
        point["linear_fit"] = 10 ** linear_log_fit
        point["quadratic_fit"] = 10 ** quadratic_log_fit

    meta = result.get("meta") or {}
    quote_price = meta.get("regularMarketPrice")
    last_price = float(quote_price) if quote_price is not None else float((quote.get("close") or [None])[-1] or points[-1]["adjusted_close"])
    best_fit = "quadratic" if quadratic_r2 >= linear_r2 else "linear"
    return {
        "symbol": symbol,
        "currency": meta.get("currency", "USD"),
        "source": "Yahoo Finance chart data",
        "period_start": points[0]["date"],
        "period_end": points[-1]["date"],
        "observations": len(points),
        "latest_price": last_price,
        "latest_adjusted_close": points[-1]["adjusted_close"],
        "total_return_pct": (points[-1]["adjusted_close"] / first_price - 1.0) * 100.0,
        "best_fit": best_fit,
        "linear_r_squared": linear_r2,
        "quadratic_r_squared": quadratic_r2,
        "concavity": concavity,
        "concavity_window_months": len(recent_values),
        "points": points,
        "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def fetch_analysis(symbol: str = "AAPL") -> Dict[str, Any]:
    """Fetch maximum available adjusted monthly data and cache analysis by ticker."""
    symbol = _normalize_ticker(symbol)
    now = time.time()
    with _cache_lock:
        cached = _analysis_cache.get(symbol)
        if cached and now < cached["expires_at"]:
            return cached["analysis"]

    period_end = int(now)
    query = urlencode({
        "period1": HISTORY_START,
        "period2": period_end,
        "interval": "1mo",
        "events": "div,splits",
    })
    request = Request(
        f"{HISTORY_URL.format(quote(symbol, safe=''))}?{query}",
        headers={"User-Agent": "Mozilla/5.0 (compatible; TrendLab/1.0)", "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=25) as response:
            payload = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"Historical data provider returned HTTP {error.code}.") from error
    except URLError as error:
        raise RuntimeError("Could not reach Yahoo Finance. Check the server's internet connection.") from error
    except TimeoutError as error:
        raise RuntimeError("The historical-price request timed out. Please try again.") from error

    analysis = build_analysis(payload, symbol)
    with _cache_lock:
        _analysis_cache[symbol] = {"analysis": analysis, "expires_at": time.time() + CACHE_SECONDS}
    return analysis


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/analysis")
def analysis():
    try:
        symbol = _normalize_ticker(request.args.get("symbol", "AAPL"))
        requested_company = (request.args.get("company") or "").strip()
        rank_text = (request.args.get("rank") or "").strip()
        market_cap_text = (request.args.get("market_cap") or "").strip()

        requested_rank = None
        if rank_text:
            requested_rank = int(rank_text)
            if requested_rank <= 0:
                raise ValueError("Rank must be a positive integer.")

        requested_market_cap = None
        if market_cap_text:
            requested_market_cap = float(market_cap_text)
            if not math.isfinite(requested_market_cap):
                raise ValueError("Market cap must be a finite number.")

        company = None
        if requested_rank is None or requested_market_cap is None or not requested_company:
            try:
                companies = fetch_sp500_companies()
                company = next((item for item in companies if item["symbol"] == symbol), None)
            except RuntimeError:
                company = None

        result = fetch_analysis(symbol)
        result["company"] = requested_company or (company["company"] if company else symbol)
        result["exchange"] = request.args.get("exchange", "")
        result["market_cap"] = requested_market_cap if requested_market_cap is not None else (company["market_cap"] if company else None)
        result["market_cap_rank"] = requested_rank if requested_rank is not None else (company["rank"] if company else None)
        return jsonify(result)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 502


@app.get("/api/search")
def search():
    try:
        query = request.args.get("q", "")
        return jsonify({"results": search_securities(query)})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 502


@app.get("/api/companies")
def companies():
    try:
        return jsonify({"companies": fetch_sp500_companies()})
    except (RuntimeError, ValueError) as error:
        return jsonify({"error": str(error)}), 502


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False, threaded=True)
