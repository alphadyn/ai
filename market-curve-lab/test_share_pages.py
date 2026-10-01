import build_share_pages as previews


def test_build_generates_escaped_github_pages_preview(tmp_path):
    securities = {'BRK-B': {'symbol': 'BRK-B', 'company': 'Berkshire </title><script>alert(1)</script> & Co'}}
    summaries = {'BRK-B': {'total': 1234.5, 'start': '1996-05-01', 'fit': 'quadratic', 'concavity': 'concave up'}}
    output = tmp_path / 's'
    assert previews.build_pages(output, securities, {'BRK-B': 9}, summaries) == 1
    page = (output / 'BRK-B' / 'index.html').read_text()
    assert 'og:url" content="https://alphadyn.github.io/ai/market-curve-lab/s/BRK-B/"' in page
    assert 'og:image" content="https://ai-orcin-eta-15.vercel.app/s/BRK-B/preview.png"' in page
    assert 'S&amp;P 500 #9): +1,234% adjusted total return since 1996' in page
    assert 'location.replace("https://alphadyn.github.io/ai/market-curve-lab/?symbol=BRK-B")' in page
    assert '<script>alert(1)' not in page


def test_description_without_cached_analysis_is_generic():
    security = {'symbol': 'MMM', 'company': '3M'}
    assert previews.describe(security, None, None).startswith('3M (MMM, S&P 500 member): long-term')
