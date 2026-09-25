import market_curve_lab.app as stock_app
from market_curve_lab.app import app, build_analysis, fit_polynomial


def make_chart_payload(adjusted, symbol="AAPL"):
    return {
        "chart": {
            "result": [{
                "timestamp": [index * 2_592_000 + 1_600_000_000 for index in range(len(adjusted))],
                "indicators": {
                    "quote": [{"close": adjusted}],
                    "adjclose": [{"adjclose": adjusted}],
                },
                "meta": {"currency": "USD", "regularMarketPrice": adjusted[-1]},
            }],
        },
    }


def test_linear_fit_recovers_exact_line():
    coefficients, r_squared = fit_polynomial([10, 20, 30, 40, 50], 1)

    assert abs(r_squared - 1.0) < 1e-12
    assert abs(coefficients[0] - 30.0) < 1e-10
    assert abs(coefficients[1] - 20.0) < 1e-10


def test_quadratic_fit_recovers_upward_curve():
    values = [4 * x * x + 2 * x + 10 for x in (-1, -0.5, 0, 0.5, 1)]
    coefficients, r_squared = fit_polynomial(values, 2)

    assert abs(r_squared - 1.0) < 1e-12
    assert coefficients[2] > 0


def test_build_analysis_reports_recent_concavity_and_trendlines():
    adjusted = [100 * 10 ** (0.4 * ((index / 29) ** 2)) for index in range(30)]

    result = build_analysis(make_chart_payload(adjusted), "MSFT")

    assert result["symbol"] == "MSFT"
    assert result["observations"] == 30
    assert result["total_return_pct"] > 0
    assert result["concavity"] == "concave up"
    assert result["best_fit"] in {"linear", "quadratic"}
    assert len(result["points"]) == 30
    assert result["points"][0]["performance"] == 100


def test_build_analysis_reports_concave_down_recent_history():
    values = [100 * 10 ** (0.8 - 0.002 * (index - 25) ** 2) for index in range(30)]

    assert build_analysis(make_chart_payload(values))["concavity"] == "concave down"


def test_analysis_route_renders_and_reports_provider_errors(monkeypatch):
    client = app.test_client()
    page = client.get("/")
    assert page.status_code == 200
    assert b"CURRENT CONCAVITY" in page.data

    monkeypatch.setattr("market_curve_lab.app.fetch_sp500_companies", lambda: [{"symbol": "AAPL", "company": "Apple Inc.", "market_cap": 3e12, "rank": 2}])
    monkeypatch.setattr("market_curve_lab.app.fetch_analysis", lambda symbol: {"symbol": symbol})
    response = client.get("/api/analysis")

    assert response.status_code == 200
    assert response.json["symbol"] == "AAPL"
    assert response.json["market_cap_rank"] == 2


def test_selected_company_analysis_and_company_list_routes(monkeypatch):
    selected = {"symbol": "MSFT", "company": "Microsoft", "market_cap": 3e12, "rank": 4}
    monkeypatch.setattr("market_curve_lab.app.fetch_sp500_companies", lambda: [selected])
    monkeypatch.setattr("market_curve_lab.app.fetch_analysis", lambda symbol: {"symbol": symbol})
    client = app.test_client()

    companies_response = client.get("/api/companies")
    analysis_response = client.get("/api/analysis?symbol=msft")

    assert companies_response.status_code == 200
    assert companies_response.json["companies"] == [selected]
    assert analysis_response.status_code == 200
    assert analysis_response.json["symbol"] == "MSFT"
    assert analysis_response.json["company"] == "Microsoft"
    assert analysis_response.json["market_cap_rank"] == 4


def test_search_route_returns_only_equity_matches(monkeypatch):
    results = [
        {"symbol": "XYZ", "company": "Example Corp.", "exchange": "NMS", "quote_type": "EQUITY"},
    ]
    monkeypatch.setattr("market_curve_lab.app.search_securities", lambda query: results if query == "example" else [])

    response = app.test_client().get("/api/search?q=example")

    assert response.status_code == 200
    assert response.json["results"] == results


def test_search_securities_filters_non_equities_and_deduplicates(monkeypatch):
    monkeypatch.setattr(stock_app, "_search_cache", {})
    monkeypatch.setattr(stock_app, "_request_json", lambda url: {"quotes": [
        {"symbol": "XYZ", "shortname": "Example Corp.", "quoteType": "EQUITY", "exchDisp": "NASDAQ"},
        {"symbol": "XYZ", "longname": "Duplicate Example", "quoteType": "EQUITY", "exchange": "NMS"},
        {"symbol": "XYZX", "shortname": "Leveraged Example ETF", "quoteType": "ETF"},
        {"symbol": "XYZ=F", "shortname": "Example Futures", "quoteType": "FUTURE"},
    ]})

    results = stock_app.search_securities("example")

    assert results == [{
        "symbol": "XYZ",
        "company": "Example Corp.",
        "exchange": "NASDAQ",
        "market_cap": None,
        "quote_type": "EQUITY",
    }]


def test_analysis_allows_a_search_selected_stock_outside_top_100(monkeypatch):
    monkeypatch.setattr("market_curve_lab.app.fetch_sp500_companies", lambda: [])
    monkeypatch.setattr("market_curve_lab.app.fetch_analysis", lambda symbol: {"symbol": symbol})

    response = app.test_client().get("/api/analysis?symbol=XYZ&company=Example%20Corp.&exchange=NMS")

    assert response.status_code == 200
    assert response.json["symbol"] == "XYZ"
    assert response.json["company"] == "Example Corp."
    assert response.json["exchange"] == "NMS"
    assert response.json["market_cap_rank"] is None


def test_analysis_rejects_invalid_ticker_syntax():
    response = app.test_client().get("/api/analysis?symbol=XYZ%2F..%2Fsecret")

    assert response.status_code == 400
    assert "valid stock ticker" in response.json["error"]


def test_sp500_ranking_filters_members_and_combines_share_classes(monkeypatch):
    rows = [
        {"symbol": f"CO{index:03}", "name": f"Company {index} Inc.", "marketCap": f"{(1000 - index) * 1_000_000:,}"}
        for index in range(99)
    ]
    rows.extend([
        {"symbol": "DUAL-A", "name": "Dual Holdings Class A", "marketCap": "2,000,000"},
        {"symbol": "DUAL-B", "name": "Dual Holdings Class B", "marketCap": "3,000,000"},
        {"symbol": "OUTSIDE", "name": "Non-member Corp.", "marketCap": "999,000,000,000"},
    ])
    constituents = [(f"CO{index:03}", f"Company {index} Inc.") for index in range(99)]
    constituents.extend([
        ("DUAL.A", "Dual Holdings (Class A)"),
        ("DUAL.B", "Dual Holdings (Class B)"),
    ])
    csv_content = "Symbol,Security\n" + "".join(f'"{symbol}","{name}"\n' for symbol, name in constituents)

    class CsvResponse:
        def read(self):
            return csv_content.encode("utf-8")

    monkeypatch.setattr(stock_app, "urlopen", lambda *args, **kwargs: CsvResponse())
    monkeypatch.setattr(stock_app, "_request_json", lambda url: {"data": {"table": {"rows": rows}}})
    monkeypatch.setattr(stock_app, "_company_cache", {"expires_at": 0.0, "companies": None})
    monkeypatch.setattr(stock_app, "SP500_COMPANY_COUNT", 100)

    companies = stock_app.fetch_sp500_companies()

    assert len(companies) == 100
    assert companies[0]["symbol"] == "CO000"
    assert companies[0]["rank"] == 1
    dual = next(company for company in companies if company["company"] == "Dual Holdings")
    assert dual["market_cap"] == 3_000_000
    assert dual["symbol"] == "DUAL-B"
    assert all(company["symbol"] != "OUTSIDE" for company in companies)


def test_full_universe_paginates_and_keeps_members_without_market_cap(monkeypatch):
    constituents = [(f"CO{index:03}", f"Company {index} Inc.") for index in range(501)]
    csv_content = "Symbol,Security\n" + "".join(f'"{symbol}","{name}"\n' for symbol, name in constituents)

    class CsvResponse:
        def read(self):
            return csv_content.encode("utf-8")

    requested_offsets = []

    def get_screener(url):
        offset = int(url.split("offset=")[1].split("&")[0])
        requested_offsets.append(offset)
        start = offset
        end = min(start + stock_app.SCREENER_LIMIT, len(constituents))
        rows = [
            {
                "symbol": symbol,
                "name": name,
                "marketCap": "NA" if index == 500 else f"{(1000 - index) * 1_000_000:,}",
            }
            for index, (symbol, name) in enumerate(constituents[start:end], start=start)
        ]
        return {"data": {"totalrecords": len(constituents), "table": {"rows": rows}}}

    monkeypatch.setattr(stock_app, "urlopen", lambda *args, **kwargs: CsvResponse())
    monkeypatch.setattr(stock_app, "_request_json", get_screener)
    monkeypatch.setattr(stock_app, "_company_cache", {"expires_at": 0.0, "companies": None})
    monkeypatch.setattr(stock_app, "SP500_COMPANY_COUNT", 501)

    companies = stock_app.fetch_sp500_companies()

    assert len(companies) == 501
    assert requested_offsets == [0, 500]
    assert companies[-1]["symbol"] == "CO500"
    assert companies[-1]["market_cap"] is None
