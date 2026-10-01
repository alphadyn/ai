"""Build crawler-readable GitHub Pages previews for every S&P 500 security."""

import csv
import html
import io
import json
import math
from pathlib import Path
import re
import shutil
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
APP_URL = 'https://alphadyn.github.io/ai/market-curve-lab/'
SHARE_URL = APP_URL + 's/'
IMAGE_ORIGIN = 'https://ai-orcin-eta-15.vercel.app/s/'
CONSTITUENTS_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv'
SUPABASE_URL = 'https://vftmcftccahjlxbxcnsf.supabase.co'
SUPABASE_ANON_KEY = 'sb_publishable_I8I-cRDhS60UoUgCvVvwnQ_MyKI9u14'
SYMBOL_PATTERN = re.compile(r'^[A-Z0-9][A-Z0-9-]{0,9}$')
DATE_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def fetch(url, headers=None):
    with urlopen(Request(url, headers=headers or {}), timeout=40) as response:
        return response.read()


def normalize_symbol(symbol):
    return symbol.strip().upper().replace('.', '-').replace('/', '-')


def load_constituents():
    # The constituent CSV is authoritative; the shared cache is publicly writable.
    reader = csv.DictReader(io.StringIO(fetch(CONSTITUENTS_URL).decode('utf-8')))
    securities = {}
    for row in reader:
        symbol = normalize_symbol(row.get('Symbol') or '')
        name = ' '.join((row.get('Security') or '').split())
        if SYMBOL_PATTERN.match(symbol) and name:
            securities[symbol] = {'symbol': symbol, 'company': name[:120]}
    if len(securities) < 490:
        raise ValueError(f'Only {len(securities)} S&P 500 constituents were found')
    return securities


def load_cache_rows(params):
    query = urlencode(params)
    headers = {'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {SUPABASE_ANON_KEY}'}
    try:
        rows = json.loads(fetch(f'{SUPABASE_URL}/rest/v1/market_curve_lab_cache?{query}', headers))
    except (OSError, ValueError):
        return []
    return rows if isinstance(rows, list) else []


def load_ranks():
    rows = load_cache_rows({'id': 'eq.companies', 'select': 'payload'})
    companies = (rows[0].get('payload') or {}).get('companies') if rows else None
    ranks = {}
    for company in companies if isinstance(companies, list) else []:
        if not isinstance(company, dict):
            continue
        rank = company.get('rank')
        if isinstance(rank, int) and 1 <= rank <= 500:
            ranks[str(company.get('symbol'))] = rank
    return ranks


def load_summaries():
    rows = load_cache_rows({
        'id': 'like.analysis:*',
        'select': 'id,total:payload->total_return_pct,start:payload->>period_start,'
                  'fit:payload->>best_fit,concavity:payload->>concavity',
    })
    summaries = {}
    for row in rows:
        symbol = str(row.get('id') or '').removeprefix('analysis:')
        total = row.get('total')
        if (isinstance(total, (int, float)) and math.isfinite(total)
                and DATE_PATTERN.match(str(row.get('start') or ''))
                and row.get('fit') in ('linear', 'quadratic')
                and row.get('concavity') in ('concave up', 'concave down')):
            summaries[symbol] = row
    return summaries


def format_percent(value):
    return f"{'+' if value >= 0 else '−'}{abs(value):,.0f}%"


def describe(security, rank, summary):
    label = f"S&P 500 #{rank}" if rank else 'S&P 500 member'
    if not summary:
        return (f"{security['company']} ({security['symbol']}, {label}): long-term adjusted "
                'performance, fitted trendlines, and recent curvature.')
    return (f"{security['company']} ({security['symbol']}, {label}): "
            f"{format_percent(summary['total'])} adjusted total return since {summary['start'][:4]}. "
            f"Closest fit: {summary['fit']}. Recent trend: {summary['concavity']}.")


def render_page(security, rank=None, summary=None):
    symbol = security['symbol']
    share_url = f'{SHARE_URL}{symbol}/'
    app_url = f'{APP_URL}?symbol={symbol}'
    image_url = f'{IMAGE_ORIGIN}{symbol}/preview.png'
    e = {key: html.escape(value, quote=True) for key, value in {
        'title': f"{symbol} · {security['company']} — Market Curve Lab",
        'description': describe(security, rank, summary),
        'share': share_url,
        'app': app_url,
        'image': image_url,
        'symbol': symbol,
    }.items()}
    # JSON is safe in a script element only after escaping '<' (including </script>).
    destination = json.dumps(app_url).replace('<', '\\u003c')
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#111916">
  <title>{e["title"]}</title>
  <meta name="description" content="{e["description"]}">
  <link rel="canonical" href="{e["share"]}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Market Curve Lab">
  <meta property="og:url" content="{e["share"]}">
  <meta property="og:title" content="{e["title"]}">
  <meta property="og:description" content="{e["description"]}">
  <meta property="og:image" content="{e["image"]}">
  <meta property="og:image:secure_url" content="{e["image"]}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{e["symbol"]} adjusted performance chart with linear and quadratic trendlines">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{e["title"]}">
  <meta name="twitter:description" content="{e["description"]}">
  <meta name="twitter:image" content="{e["image"]}">
  <style>
    body{{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#0d1411;color:#f1f4ed;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}
    main{{width:min(100%,640px)}}img{{display:block;width:100%;height:auto;border:1px solid #293930;border-radius:14px}}
    p{{color:#a3b0a5}}a{{display:inline-block;margin-top:8px;padding:12px 18px;border-radius:10px;background:#d3ef83;color:#0d1411;font-weight:700;text-decoration:none}}
  </style>
</head>
<body>
  <main>
    <img src="{e["image"]}" alt="">
    <p>{e["description"]}</p>
    <a href="{e["app"]}">Open {e["symbol"]} in Market Curve Lab</a>
  </main>
  <script>location.replace({destination});</script>
</body>
</html>
'''


def build_pages(output, securities, ranks=None, summaries=None):
    ranks = ranks or {}
    summaries = summaries or {}
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    for symbol, security in securities.items():
        page_dir = output / symbol
        page_dir.mkdir()
        (page_dir / 'index.html').write_text(render_page(security, ranks.get(symbol), summaries.get(symbol)))
    return len(securities)


def main():
    count = build_pages(ROOT / 's', load_constituents(), load_ranks(), load_summaries())
    print(f'Built {count} Market Curve Lab security previews')


if __name__ == '__main__':
    main()
