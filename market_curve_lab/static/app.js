const VERCEL_API = 'https://ai-orcin-eta-15.vercel.app/api';
const API = window.location.hostname.endsWith('github.io') ? VERCEL_API : '/api';
const chart = document.querySelector('#performance-chart');
const loadingPanel = document.querySelector('#chart-loading');
const errorPanel = document.querySelector('#chart-error');
const tickerSearch = document.querySelector('#ticker-search');
const tickerResults = document.querySelector('#ticker-results');
const refreshButton = document.querySelector('#refresh-button');
const cacheNote = document.querySelector('#cache-note');
const loadStatus = document.querySelector('#load-status');
const loadCount = document.querySelector('#load-count');
const loadProgressBar = document.querySelector('#load-progress-bar');
const loadProgressTrack = document.querySelector('.load-progress-track');
const seriesVisibility = { actual: true, quadratic: true, linear: true };
const SVG_NS = 'http://www.w3.org/2000/svg';
const CHART = { width: 1000, height: 390, left: 76, right: 18, top: 22, bottom: 46 };
let selectedSymbol = 'AAPL';
let requestSequence = 0;
let companiesBySymbol = new Map();
let selectedSecurity = { symbol: 'AAPL', company: 'Apple Inc.' };
let sp500Companies = [];
let visibleMatches = [];
let activeMatchIndex = -1;
let searchTimer;
let searchController;
let userHasEditedSearch = false;
let isRefreshing = false;

// Shared server-side cache (Supabase/Postgres) so page loads read saved results instead of
// re-ranking the S&P 500 and re-fetching price history every time; the refresh button overwrites it.
const SUPABASE_URL = 'https://vftmcftccahjlxbxcnsf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I8I-cRDhS60UoUgCvVvwnQ_MyKI9u14';
const CACHE_TABLE = `${SUPABASE_URL}/rest/v1/market_curve_lab_cache`;
const SUPABASE_HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

async function loadCachedRow(id) {
  try {
    const response = await fetch(`${CACHE_TABLE}?id=eq.${encodeURIComponent(id)}&select=payload,updated_at`, { headers: SUPABASE_HEADERS });
    if (!response.ok) return null;
    const rows = await response.json();
    const row = rows[0];
    if (!row) return null;
    return { payload: row.payload, updatedAt: row.updated_at ? Date.parse(row.updated_at) : null };
  } catch (error) {
    return null;
  }
}

async function saveCachedRow(id, payload) {
  try {
    await fetch(CACHE_TABLE, {
      method: 'POST',
      headers: { ...SUPABASE_HEADERS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ id, payload, updated_at: new Date().toISOString() }]),
    });
  } catch (error) {
    // cache save is best-effort; the data already on screen is unaffected
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function updateProgress(completed, total, label) {
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  loadStatus.textContent = label;
  loadCount.textContent = `${completed} / ${total}`;
  loadProgressBar.style.width = `${percentage}%`;
  loadProgressTrack.setAttribute('aria-valuenow', String(percentage));
}


function formatMoney(value, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`;
  }
}

function formatPercent(value) {
  const formatted = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return `${value >= 0 ? '+' : '−'}${formatted}%`;
}

function svgElement(tag, attributes = {}, text = '') {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  if (text) element.textContent = text;
  return element;
}

function formatIndex(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return `$${Math.round(value)}`;
}

function renderChart(points) {
  const maxValue = Math.max(...points.map((point) => point.performance));
  const minExponent = 2;
  const maxExponent = Math.ceil(Math.log10(maxValue));
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const minLog = minExponent;
  const maxLog = Math.max(maxExponent, minExponent + 1);
  const x = (index) => CHART.left + (index / (points.length - 1)) * plotWidth;
  const y = (value) => CHART.top + (1 - (Math.log10(Math.max(10 ** minExponent, value)) - minLog) / (maxLog - minLog)) * plotHeight;
  const makePath = (key) => points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)},${y(point[key]).toFixed(2)}`).join(' ');

  chart.replaceChildren();
  const defs = svgElement('defs');
  const gradient = svgElement('linearGradient', { id: 'performance-fill', x1: '0', x2: '0', y1: '0', y2: '1' });
  gradient.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#d0ed7a', 'stop-opacity': '.16' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#d0ed7a', 'stop-opacity': '0' }),
  );
  defs.append(gradient);
  chart.append(defs);

  for (let exponent = minExponent; exponent <= maxExponent; exponent += 1) {
    const tickValue = 10 ** exponent;
    const tickY = y(tickValue);
    chart.append(
      svgElement('line', { class: 'grid-line', x1: CHART.left, x2: CHART.width - CHART.right, y1: tickY, y2: tickY }),
      svgElement('text', { class: 'chart-grid-label', x: CHART.left - 12, y: tickY + 3, 'text-anchor': 'end' }, formatIndex(tickValue)),
    );
  }

  const baselineY = CHART.height - CHART.bottom;
  chart.append(svgElement('line', { class: 'chart-axis', x1: CHART.left, x2: CHART.width - CHART.right, y1: baselineY, y2: baselineY }));
  const firstYear = points[0].date.slice(0, 4);
  const lastYear = points.at(-1).date.slice(0, 4);
  for (let tick = 0; tick <= 4; tick += 1) {
    const index = Math.round(tick * (points.length - 1) / 4);
    chart.append(svgElement('text', {
      class: 'chart-date-label',
      x: x(index),
      y: CHART.height - 13,
      'text-anchor': tick === 0 ? 'start' : tick === 4 ? 'end' : 'middle',
    }, points[index].date.slice(0, 4)));
  }

  const actualPath = makePath('performance');
  const areaPath = `${actualPath} L${x(points.length - 1)},${baselineY} L${x(0)},${baselineY} Z`;
  const actualArea = svgElement('path', { class: 'performance-area series-toggle', 'data-series': 'actual', d: areaPath });
  const actualLine = svgElement('path', { class: 'series-actual series-toggle', 'data-series': 'actual', d: actualPath });
  const quadratic = svgElement('path', { class: 'series-quadratic series-toggle', 'data-series': 'quadratic', d: makePath('quadratic_fit') });
  const linear = svgElement('path', { class: 'series-linear series-toggle', 'data-series': 'linear', d: makePath('linear_fit') });
  chart.append(actualArea, linear, quadratic, actualLine);
  chart.querySelectorAll('.series-toggle').forEach((series) => {
    series.style.display = seriesVisibility[series.dataset.series] ? '' : 'none';
  });

}

function renderAnalysis(data) {
  const currency = data.currency || 'USD';
  document.querySelector('#ticker-company').textContent = data.company || data.symbol;
  document.querySelector('#ticker-symbol').textContent = data.market_cap_rank
    ? `${data.symbol} · S&P RANK #${data.market_cap_rank}`
    : `${data.symbol}${data.exchange ? ` · ${data.exchange}` : ''}`;
  document.querySelector('#company-rank').textContent = data.market_cap_rank ? `S&P #${data.market_cap_rank}` : 'ANY LISTED STOCK';
  document.querySelector('#ticker-price').textContent = formatMoney(data.latest_price, currency);
  document.querySelector('#ticker-currency').textContent = `${currency} · LATEST QUOTE`;
  document.querySelector('#data-asof').textContent = `As of ${data.period_end}`;
  document.querySelector('#total-return').textContent = formatPercent(data.total_return_pct);
  document.querySelector('#history-period').textContent = `${data.period_start} — ${data.period_end} · total return`;
  document.querySelector('#best-fit').textContent = `${data.best_fit} curve`;
  const rSquared = data.best_fit === 'quadratic' ? data.quadratic_r_squared : data.linear_r_squared;
  document.querySelector('#fit-quality').textContent = `R² ${(rSquared * 100).toFixed(1)}% · ${data.observations} monthly observations`;

  const direction = data.concavity === 'concave up' ? 'up' : 'down';
  const concavityCard = document.querySelector('#concavity-card');
  concavityCard.dataset.direction = direction;
  document.querySelector('#concavity').textContent = data.concavity;
  document.querySelector('#concavity-symbol').textContent = direction === 'up' ? '⌣' : '⌒';
  document.querySelector('#concavity-detail').textContent = `Recent quadratic fit · ${data.concavity_window_months} monthly observations`;
  document.querySelector('#observation-count').textContent = `${data.observations} POINTS`;
  document.querySelector('#chart-heading').textContent = `${data.company || data.symbol}: the shape of its climb`;
  document.querySelector('#chart-loading').querySelector('span:last-child').textContent = `Fitting ${data.symbol}'s full available adjusted price history.`;

  renderChart(data.points);
  loadingPanel.hidden = true;
  errorPanel.hidden = true;
  chart.removeAttribute('hidden');
}

async function loadAnalysis(security, { forceRefresh = false } = {}) {
  const symbol = typeof security === 'string' ? security : security.symbol;
  selectedSymbol = symbol;
  selectedSecurity = typeof security === 'string' ? companiesBySymbol.get(symbol) || { symbol } : security;
  const requestId = ++requestSequence;
  const selectedCompany = selectedSecurity;
  if (selectedCompany) {
    document.querySelector('#ticker-company').textContent = selectedCompany.company;
    document.querySelector('#ticker-symbol').textContent = selectedCompany.rank
      ? `${symbol} · S&P RANK #${selectedCompany.rank}`
      : `${symbol}${selectedCompany.exchange ? ` · ${selectedCompany.exchange}` : ''}`;
    document.querySelector('#company-rank').textContent = selectedCompany.rank ? `S&P #${selectedCompany.rank}` : 'ANY LISTED STOCK';
    document.querySelector('#chart-heading').textContent = `${selectedCompany.company}: the shape of its climb`;
  }
  loadingPanel.hidden = false;
  errorPanel.hidden = true;
  chart.setAttribute('hidden', '');
  document.querySelector('#chart-loading').querySelector('strong').textContent = `Loading ${symbol}`;
  const cacheId = `analysis:${symbol}`;
  try {
    if (!forceRefresh) {
      updateProgress(1, 2, `Checking saved ${symbol} history…`);
      const cached = await loadCachedRow(cacheId);
      if (requestId !== requestSequence) return;
      if (cached) {
        updateProgress(2, 2, 'Using saved results');
        renderAnalysis(cached.payload);
        updateCacheNote(cached.updatedAt);
        return;
      }
    }
    updateProgress(1, 2, `Loading ${symbol} price history…`);
    const params = new URLSearchParams({ symbol });
    if (selectedCompany?.company) params.set('company', selectedCompany.company);
    if (selectedCompany?.exchange) params.set('exchange', selectedCompany.exchange);
    const response = await fetch(`${API}/analysis?${params}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Could not load ${symbol} history.`);
    if (requestId !== requestSequence) return;
    updateProgress(2, 2, 'Fitting trendlines');
    renderAnalysis(data);
    updateCacheNote(Date.now());
    saveCachedRow(cacheId, data);
  } catch (error) {
    if (requestId !== requestSequence) return;
    loadingPanel.hidden = true;
    errorPanel.hidden = false;
    document.querySelector('#error-copy').textContent = error instanceof Error ? error.message : `Could not load ${symbol} history.`;
  }
}

function updateCacheNote(timestamp) {
  cacheNote.textContent = timestamp ? `Saved results · ${formatRelativeTime(timestamp)}` : '';
}

async function loadCompanies(forceRefresh = false) {
  try {
    let companiesPayload = null;
    let cacheTimestamp = null;
    if (!forceRefresh) {
      updateProgress(0, 2, 'Checking saved S&P 500 rankings…');
      const cached = await loadCachedRow('companies');
      if (cached) {
        companiesPayload = cached.payload.companies;
        cacheTimestamp = cached.updatedAt;
      }
    }
    if (!companiesPayload) {
      updateProgress(0, 2, 'Loading S&P 500 rankings…');
      const response = await fetch(`${API}/companies`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load S&P 500 company rankings.');
      companiesPayload = payload.companies || [];
      cacheTimestamp = Date.now();
      saveCachedRow('companies', { companies: companiesPayload });
    }
    sp500Companies = companiesPayload;
    companiesBySymbol = new Map(sp500Companies.map((company) => [company.symbol, company]));
    updateCacheNote(cacheTimestamp);
    if (userHasEditedSearch) {
        const selectedCompany = companiesBySymbol.get(selectedSymbol);
        if (selectedCompany && tickerSearch.value.trim().toUpperCase() === selectedSymbol) {
        await loadAnalysis(selectedCompany, { forceRefresh });
        return;
        }
      await searchTicker(tickerSearch.value);
      return;
    }
    const preferred = companiesBySymbol.get(selectedSymbol) || sp500Companies[0];
    if (!preferred) throw new Error('No S&P 500 companies were returned by the market-data provider.');
    tickerSearch.value = preferred.symbol;
    await loadAnalysis(preferred, { forceRefresh });
  } catch (error) {
    // The ticker-search endpoint still allows any listed stock if the ranking feed is unavailable.
    document.querySelector('#company-rank').textContent = 'SEARCH ANY STOCK';
    await searchTicker(tickerSearch.value || 'AAPL');
  }
}

function closeSearchResults() {
  tickerResults.hidden = true;
  tickerSearch.setAttribute('aria-expanded', 'false');
  tickerSearch.removeAttribute('aria-activedescendant');
  activeMatchIndex = -1;
}

function chooseSecurity(security) {
  clearTimeout(searchTimer);
  tickerSearch.value = security.symbol;
  closeSearchResults();
  loadAnalysis(security);
}

function renderSearchResults(matches, message = '') {
  visibleMatches = matches;
  activeMatchIndex = -1;
  tickerResults.replaceChildren();

  if (!matches.length) {
    const empty = document.createElement('div');
    empty.className = 'ticker-results-message';
    empty.textContent = message || 'No matching stocks found.';
    tickerResults.append(empty);
  } else {
    matches.forEach((security, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.id = `ticker-option-${index}`;
      option.className = 'ticker-result';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');

      const symbol = document.createElement('span');
      symbol.className = 'result-symbol';
      symbol.textContent = security.symbol;
      const company = document.createElement('span');
      company.className = 'result-company';
      company.textContent = security.company;
      const exchange = document.createElement('span');
      exchange.className = 'result-exchange';
      exchange.textContent = security.rank ? `S&P #${security.rank}` : security.exchange || 'EQUITY';
      option.append(symbol, company, exchange);
      option.addEventListener('mousedown', (event) => event.preventDefault());
      option.addEventListener('click', () => chooseSecurity(security));
      tickerResults.append(option);
    });
  }

  tickerResults.hidden = false;
  tickerSearch.setAttribute('aria-expanded', 'true');
}

async function searchTicker(query) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    renderSearchResults(sp500Companies.slice(0, 8), 'S&P 500 companies, ranked by market cap');
    return;
  }
  if (searchController) searchController.abort();
  searchController = new AbortController();
  const controller = searchController;
  renderSearchResults([], 'Searching listed stocks…');

  try {
    const response = await fetch(`${API}/search?q=${encodeURIComponent(normalizedQuery)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Stock search is unavailable.');

    const queryUpper = normalizedQuery.toUpperCase();
    const rankedCompanies = sp500Companies.filter((company) =>
      company.symbol.includes(queryUpper) || company.company.toLowerCase().includes(normalizedQuery.toLowerCase()),
    );
    const seen = new Set();
    const matches = [...rankedCompanies, ...(payload.results || [])].filter((security) => {
      if (seen.has(security.symbol)) return false;
      seen.add(security.symbol);
      return true;
    }).slice(0, 10);
    renderSearchResults(matches);
  } catch (error) {
    if (error.name === 'AbortError') return;
    const queryLower = normalizedQuery.toLowerCase();
    const localMatches = sp500Companies.filter((company) =>
      company.symbol.includes(normalizedQuery.toUpperCase()) || company.company.toLowerCase().includes(queryLower),
    );
    renderSearchResults(localMatches.slice(0, 10), localMatches.length ? '' : error instanceof Error ? error.message : 'Stock search is unavailable.');
  }
}

tickerSearch.addEventListener('input', () => {
  userHasEditedSearch = true;
  clearTimeout(searchTimer);
  if (searchController) searchController.abort();
  renderSearchResults([], tickerSearch.value.trim() ? 'Searching listed stocks…' : 'S&P 500 companies, ranked by market cap');
  searchTimer = window.setTimeout(() => searchTicker(tickerSearch.value), 250);
});
tickerSearch.addEventListener('focus', () => {
  if (!tickerResults.hidden) return;
  if (tickerSearch.value.trim()) searchTicker(tickerSearch.value);
  else renderSearchResults(sp500Companies.slice(0, 8));
});
tickerSearch.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSearchResults();
    return;
  }
  if (tickerResults.hidden || !visibleMatches.length) {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchTicker(tickerSearch.value).then(() => {
        if (visibleMatches.length === 1) chooseSecurity(visibleMatches[0]);
      });
    }
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    activeMatchIndex = (activeMatchIndex + direction + visibleMatches.length) % visibleMatches.length;
    tickerResults.querySelectorAll('[role="option"]').forEach((option, index) => {
      const active = index === activeMatchIndex;
      option.setAttribute('aria-selected', String(active));
      if (active) tickerSearch.setAttribute('aria-activedescendant', option.id);
    });
  } else if (event.key === 'Enter') {
    event.preventDefault();
    chooseSecurity(visibleMatches[activeMatchIndex >= 0 ? activeMatchIndex : 0]);
  }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.ticker-search-wrap')) closeSearchResults();
});
document.querySelectorAll('.legend-item').forEach((button) => {
  button.addEventListener('click', () => {
    const series = button.dataset.series;
    seriesVisibility[series] = !seriesVisibility[series];
    button.classList.toggle('is-active', seriesVisibility[series]);
    button.setAttribute('aria-pressed', String(seriesVisibility[series]));
    chart.querySelectorAll(`[data-series="${series}"]`).forEach((line) => {
      line.style.display = seriesVisibility[series] ? '' : 'none';
    });
  });
});

document.querySelector('#retry-button').addEventListener('click', () => {
  loadAnalysis(selectedSecurity);
});
refreshButton.addEventListener('click', async () => {
  if (isRefreshing) return;
  isRefreshing = true;
  refreshButton.disabled = true;
  try {
    await loadCompanies(true);
  } finally {
    isRefreshing = false;
    refreshButton.disabled = false;
  }
});
loadCompanies();
