import { randomUUID } from 'node:crypto';
import { fetchAnalysis, fetchSp500Companies, normalizeSymbol, normalizeTicker, searchSecurities, ValidationError } from './_lib/market.js';

const DEFAULT_APP_URL = 'https://alphadyn.github.io/ai/market_curve_lab/';
const FALLBACK_IMAGE = `${DEFAULT_APP_URL}static/social-preview.png`;
// Same public read-only cache the browser app uses.
const SUPABASE_URL = 'https://vftmcftccahjlxbxcnsf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I8I-cRDhS60UoUgCvVvwnQ_MyKI9u14';
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const COLORS = { bg: '#0d1411', surface: '#121b17', line: '#293930', cream: '#f1f4ed', muted: '#a3b0a5', quiet: '#78877c', lime: '#d3ef83', gold: '#efc27e', teal: '#7fb5a2', red: '#ee9382' };

function appBaseUrl() {
  const configured = process.env.MARKET_CURVE_APP_URL || DEFAULT_APP_URL;
  try {
    const url = new URL(configured);
    if (url.protocol === 'https:' || url.hostname === 'localhost') return url.href.endsWith('/') ? url.href : `${url.href}/`;
  } catch {
    // Fall through to the public GitHub Pages deployment.
  }
  return DEFAULT_APP_URL;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function readCache(id) {
  try {
    const url = new URL('/rest/v1/market_curve_lab_cache', SUPABASE_URL);
    url.searchParams.set('id', `eq.${id}`);
    url.searchParams.set('select', 'payload');
    const response = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!response.ok) return null;
    const [row] = await response.json();
    return row?.payload ?? null;
  } catch {
    return null;
  }
}

async function loadCompanies() {
  const cached = await readCache('companies');
  if (Array.isArray(cached?.companies)) return cached.companies;
  try {
    return await fetchSp500Companies();
  } catch {
    return [];
  }
}

async function loadSecurity(requestedSymbol) {
  const [companies, requestedCache] = await Promise.all([loadCompanies(), readCache(`analysis:${requestedSymbol}`)]);
  // S&P tickers are stored with dashes (BRK-B), so BRK.B links resolve to the same member.
  const member = companies.find((company) => company.symbol === requestedSymbol)
    || companies.find((company) => company.symbol === normalizeSymbol(requestedSymbol));
  const symbol = member?.symbol || requestedSymbol;
  const cached = symbol === requestedSymbol ? requestedCache : await readCache(`analysis:${symbol}`);
  const analysis = Array.isArray(cached?.points) && cached.points.length > 1 ? cached : await fetchAnalysis(symbol);

  let company = member?.company || (analysis.company && analysis.company !== symbol ? analysis.company : null);
  if (!company) {
    const matches = await searchSecurities(symbol).catch(() => []);
    company = matches.find((match) => match.symbol === symbol)?.company || symbol;
  }
  return { ...analysis, symbol, company, market_cap_rank: member?.rank ?? analysis.market_cap_rank ?? null };
}

function formatPercent(value) {
  const formatted = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `${value >= 0 ? '+' : '−'}${formatted}%`;
}

function formatMoney(value, currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`;
  }
}

function describe(security) {
  const rank = security.market_cap_rank ? `S&P 500 #${security.market_cap_rank}` : 'listed stock';
  const rSquared = security.best_fit === 'quadratic' ? security.quadratic_r_squared : security.linear_r_squared;
  return `${security.company} (${security.symbol}, ${rank}): ${formatPercent(security.total_return_pct)} adjusted total return since ${security.period_start.slice(0, 4)}. `
    + `Closest fit: ${security.best_fit} (R² ${(rSquared * 100).toFixed(1)}%). Recent trend: ${security.concavity}.`;
}

function samplePoints(points, maxPoints = 180) {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}

function chartSvg(allPoints, width, height) {
  const points = samplePoints(allPoints);
  const values = points.flatMap((point) => [point.performance, point.linear_fit, point.quadratic_fit]).filter((value) => value > 0);
  const minLog = Math.min(2, Math.floor(Math.log10(Math.min(...values))));
  const maxLog = Math.max(minLog + 1, Math.ceil(Math.log10(Math.max(...values))));
  const pad = 6;
  const x = (index) => pad + (index / (points.length - 1)) * (width - pad * 2);
  const y = (value) => pad + (1 - (Math.log10(Math.max(10 ** minLog, value)) - minLog) / (maxLog - minLog)) * (height - pad * 2);
  const path = (key) => points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ');
  const actual = path('performance');
  const grid = [];
  for (let exponent = minLog; exponent <= maxLog; exponent += 1) {
    const gridY = y(10 ** exponent).toFixed(1);
    grid.push(`<line x1="0" x2="${width}" y1="${gridY}" y2="${gridY}" stroke="${COLORS.line}" stroke-width="1"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + '<defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#d3ef83" stop-opacity=".22"/><stop offset="100%" stop-color="#d3ef83" stop-opacity="0"/></linearGradient></defs>'
    + grid.join('')
    + `<path d="${actual} L${x(points.length - 1)},${height} L${x(0)},${height} Z" fill="url(#fill)"/>`
    + `<path d="${path('linear_fit')}" fill="none" stroke="${COLORS.teal}" stroke-width="3" stroke-dasharray="12 10" opacity=".85"/>`
    + `<path d="${path('quadratic_fit')}" fill="none" stroke="${COLORS.gold}" stroke-width="3.5" stroke-dasharray="3 9" stroke-linecap="round"/>`
    + `<path d="${actual}" fill="none" stroke="${COLORS.lime}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`
    + '</svg>';
}

// Satori takes React-like element objects; this avoids needing a JSX build step.
function el(type, style, ...children) {
  const props = { style: type === 'div' ? { display: 'flex', ...style } : style };
  if (children.length) props.children = children.length === 1 ? children[0] : children;
  return { type, props };
}

function stat(label, value, color = COLORS.cream) {
  return el('div', { flexDirection: 'column', flex: 1, padding: '20px 24px', border: `1px solid ${COLORS.line}`, borderRadius: 14, background: COLORS.surface },
    el('div', { fontSize: 17, letterSpacing: 2, color: COLORS.quiet }, label),
    el('div', { fontSize: 30, marginTop: 8, color, whiteSpace: 'nowrap' }, value));
}

function previewElement(security) {
  const chartWidth = 640;
  const chartHeight = 290;
  const chartSrc = `data:image/svg+xml;base64,${Buffer.from(chartSvg(security.points, chartWidth, chartHeight)).toString('base64')}`;
  const rSquared = security.best_fit === 'quadratic' ? security.quadratic_r_squared : security.linear_r_squared;
  const company = security.company.length > 34 ? `${security.company.slice(0, 33).trimEnd()}…` : security.company;
  const concaveUp = security.concavity === 'concave up';

  return el('div', { width: '100%', height: '100%', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 60px', background: COLORS.bg, color: COLORS.cream },
    el('div', { justifyContent: 'space-between', alignItems: 'center', fontSize: 20, letterSpacing: 4 },
      el('div', { color: COLORS.lime }, 'MARKET CURVE LAB'),
      el('div', { color: COLORS.muted }, security.market_cap_rank ? `S&P 500 · RANK #${security.market_cap_rank}` : 'LISTED EQUITY')),
    el('div', { alignItems: 'center', justifyContent: 'space-between' },
      el('div', { flexDirection: 'column', width: 420 },
        el('div', { fontSize: 110, lineHeight: 1, letterSpacing: -3 }, security.symbol),
        el('div', { fontSize: 32, marginTop: 14, color: COLORS.muted }, company),
        el('div', { fontSize: 28, marginTop: 18, color: COLORS.quiet }, `${formatMoney(security.latest_price, security.currency || 'USD')} · ${security.period_end}`)),
      { type: 'img', props: { src: chartSrc, width: chartWidth, height: chartHeight } }),
    el('div', { gap: 18 },
      stat(`TOTAL RETURN SINCE ${security.period_start.slice(0, 4)}`, formatPercent(security.total_return_pct), security.total_return_pct >= 0 ? COLORS.lime : COLORS.red),
      stat('CLOSEST FIT', `${security.best_fit} · R² ${(rSquared * 100).toFixed(0)}%`),
      stat('RECENT CURVATURE', security.concavity, concaveUp ? COLORS.lime : COLORS.gold)));
}

async function sendImage(response, security) {
  // Loaded lazily so a renderer failure only affects the image, not the preview page.
  const { ImageResponse } = await import('@vercel/og');
  const image = new ImageResponse(previewElement(security), { width: IMAGE_WIDTH, height: IMAGE_HEIGHT });
  const bytes = Buffer.from(await image.arrayBuffer());
  response.status(200);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Content-Type', 'image/png');
  response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.send(bytes);
}

function sendPage(response, html, status, scriptNonce = null) {
  response.status(status);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  response.setHeader('Content-Security-Policy', `default-src 'none'; img-src https:; style-src 'unsafe-inline'; script-src ${scriptNonce ? `'nonce-${scriptNonce}'` : "'none'"}; base-uri 'none'; frame-ancestors 'none'`);
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.send(html);
}

function renderPage(response, { symbol, security, imageUrl, appUrl }) {
  const title = security ? `${security.symbol} · ${security.company} — Market Curve Lab` : `${symbol} — Market Curve Lab`;
  const description = security ? describe(security) : `Long-term adjusted performance, fitted trendlines, and recent curvature for ${symbol}.`;
  const image = security ? imageUrl : FALLBACK_IMAGE;
  const scriptNonce = randomUUID();
  const e = { title: escapeHtml(title), description: escapeHtml(description), image: escapeHtml(image), appUrl: escapeHtml(appUrl) };
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#111916">
  <title>${e.title}</title>
  <meta name="description" content="${e.description}">
  <link rel="canonical" href="${e.appUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Market Curve Lab">
  <meta property="og:url" content="${e.appUrl}">
  <meta property="og:title" content="${e.title}">
  <meta property="og:description" content="${e.description}">
  <meta property="og:image" content="${e.image}">
  <meta property="og:image:secure_url" content="${e.image}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="${IMAGE_WIDTH}">
  <meta property="og:image:height" content="${IMAGE_HEIGHT}">
  <meta property="og:image:alt" content="${escapeHtml(`${symbol} adjusted performance chart with linear and quadratic trendlines`)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${e.title}">
  <meta name="twitter:description" content="${e.description}">
  <meta name="twitter:image" content="${e.image}">
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#0d1411;color:#f1f4ed;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(100%,640px)}img{display:block;width:100%;height:auto;border:1px solid #293930;border-radius:14px}
    p{color:#a3b0a5}a{display:inline-block;margin-top:8px;padding:12px 18px;border-radius:10px;background:#d3ef83;color:#0d1411;font-weight:700;text-decoration:none}
  </style>
</head>
<body>
  <main>
    <img src="${e.image}" alt="">
    <p>${e.description}</p>
    <a href="${e.appUrl}">Open ${escapeHtml(symbol)} in Market Curve Lab</a>
  </main>
  <script nonce="${scriptNonce}">location.replace(${JSON.stringify(appUrl).replace(/</g, '\\u003c')});</script>
</body>
</html>`;
  sendPage(response, html, 200, scriptNonce);
}

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.status(405).send('Method not allowed');
    return;
  }

  let symbol;
  try {
    symbol = normalizeTicker(String(firstQueryValue(request.query.symbol) || ''));
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    sendPage(response, '<!doctype html><title>Not found · Market Curve Lab</title><p>Unknown ticker.</p>', 404);
    return;
  }
  const wantsImage = String(firstQueryValue(request.query.image) || '') === '1';

  let security = null;
  try {
    security = await loadSecurity(symbol);
  } catch {
    // Upstream data is unavailable; fall back to the generic preview below.
  }

  if (wantsImage) {
    if (!security) {
      response.redirect(302, FALLBACK_IMAGE);
      return;
    }
    try {
      await sendImage(response, security);
    } catch {
      response.redirect(302, FALLBACK_IMAGE);
    }
    return;
  }

  const canonicalSymbol = security?.symbol || symbol;
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const selfUrl = `https://${host}/s/${encodeURIComponent(canonicalSymbol)}`;
  const imageUrl = `${selfUrl}/preview.png`;
  const appUrl = new URL(appBaseUrl());
  appUrl.searchParams.set('symbol', canonicalSymbol);
  renderPage(response, { symbol: canonicalSymbol, security, imageUrl, appUrl: appUrl.href });
}
