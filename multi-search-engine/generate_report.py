#!/usr/bin/env python3
"""
Report generator for Multi-Search Engine App.
Generates generated_report.html documenting features and a sample multi-engine search report.
"""

from pathlib import Path
import sys

root = Path(__file__).parent
sys.path.insert(0, str(root))

from search_engine import MultiSearchAggregator

output_path = root / "generated_report.html"

title = "Multi-Search Engine Web App"
description = "A responsive web application that searches words or phrases across up to 5 search engines and produces a unified report with one-line findings (up to 10 results per engine)."
bullets = [
    "Input any word or phrase with instant multi-engine querying",
    "Select up to 5 search engines (Google, Bing, DuckDuckGo, Yahoo, Wikipedia, Brave, arXiv, Ecosia)",
    "Returns up to 10 search results per engine (up to 50 findings per query)",
    "Summary formatted as direct destination links: [Source] [Summary](destination_link)",
    "Live client-side and backend Python API search modes with real-time progress indicators",
    "One-click report exports (Copy One-Line Report, Download TXT, Markdown, HTML, JSON)",
    "Search term highlighting, engine filtering, and quick direct search links",
]

# Run a sample search to include live findings in the report
sample_query = "quantum computing algorithms"
aggregator = MultiSearchAggregator(
    engines=["google", "bing", "duckduckgo", "yahoo", "wikipedia"],
    max_results_per_engine=5,
)
sample_data = aggregator.search(sample_query)

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <style>
    :root {{
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      --accent: #38bdf8;
      --code-bg: #090d16;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2.5rem 1rem;
    }}
    .container {{
      max-width: 900px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.5rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }}
    .header {{
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }}
    .badge {{
      display: inline-block;
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent);
      padding: 0.3rem 0.8rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }}
    h1 {{
      font-size: 2rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.5rem;
    }}
    p.desc {{
      color: var(--text-muted);
      font-size: 1.1rem;
    }}
    h2 {{
      font-size: 1.3rem;
      font-weight: 600;
      color: #e2e8f0;
      margin: 1.75rem 0 0.75rem;
    }}
    ul.features {{
      padding-left: 1.25rem;
      margin-bottom: 1.5rem;
      color: #cbd5e1;
    }}
    ul.features li {{
      margin-bottom: 0.4rem;
    }}
    .report-card {{
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.25rem;
      margin-top: 1rem;
      overflow-x: auto;
    }}
    .report-meta {{
      font-size: 0.85rem;
      color: var(--accent);
      margin-bottom: 0.75rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }}
    pre.report-content {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.88rem;
      color: #f1f5f9;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.7;
    }}
    .footer {{
      margin-top: 2.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border);
      font-size: 0.85rem;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}
    a.btn {{
      display: inline-block;
      background: var(--primary);
      color: #ffffff;
      text-decoration: none;
      padding: 0.5rem 1.2rem;
      border-radius: 8px;
      font-weight: 500;
      font-size: 0.9rem;
      transition: background 0.2s;
    }}
    a.btn:hover {{
      background: var(--primary-dark);
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">Web Application &amp; Multi-Engine Search</span>
      <h1>{title}</h1>
      <p class="desc">{description}</p>
    </div>

    <h2>Key Capabilities</h2>
    <ul class="features">
"""

for item in bullets:
    html += f"      <li>{item}</li>\n"

html += f"""    </ul>

    <h2>Sample One-Line Report Output</h2>
    <div class="report-card">
      <div class="report-meta">Query: "{sample_data['query']}" &bull; Engines ({len(sample_data['engines_queried'])}): {', '.join(sample_data['engines_queried'])} &bull; Findings: {sample_data['total_results']}</div>
      <pre class="report-content">"""

for line in sample_data["one_line_report"]:
    html += f"{line}\n"

html += f"""</pre>
    </div>

    <div class="footer">
      <span>Generated by <code>generate_report.py</code></span>
      <a class="btn" href="index.html">Open Web App</a>
    </div>
  </div>
</body>
</html>
"""

output_path.write_text(html, encoding="utf-8")
print(f"Generated {output_path}")
