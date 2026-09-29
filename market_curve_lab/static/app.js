const VERCEL_API = 'https://ai-orcin-eta-15.vercel.app/api';
const VERCEL_SHARE_URL = 'https://ai-orcin-eta-15.vercel.app/s/';
const PAGES_APP_URL = 'https://alphadyn.github.io/ai/market_curve_lab/';
const API = window.location.hostname.endsWith('github.io') ? VERCEL_API : '/api';
const TICKER_PATTERN = /^[A-Z0-9^][A-Z0-9.^=_-]{0,19}$/;
const $ = (selector) => document.querySelector(selector);
const chart = $('#performance-chart');
const loadingPanel = $('#chart-loading');
const loadingTitle = $('#loading-title') || $('#chart-loading strong');
const errorPanel = $('#chart-error');
const errorCopy = $('#error-copy');
const tickerSearch = $('#ticker-search');
const tickerResults = $('#ticker-results');
const refreshButton = $('#refresh-button');
const shareButton = $('#share-button');
const cacheNote = $('#cache-note');
const loadStatus = $('#load-status');
const loadProgressBar = $('#load-progress-bar');
const loadProgressTrack = $('.load-progress-track');
const tickerCompany = $('#ticker-company');
const tickerSymbol = $('#ticker-symbol');
const companyRank = $('#company-rank');
const tickerPrice = $('#ticker-price');
const tickerCurrency = $('#ticker-currency');
const dataAsOf = $('#data-asof');
const totalReturn = $('#total-return');
const historyPeriod = $('#history-period');
const bestFitLabel = $('#best-fit');
const fitQuality = $('#fit-quality');
const concavityCard = $('#concavity-card');
const concavityLabel = $('#concavity');
const concavitySymbol = $('#concavity-symbol');
const concavityDetail = $('#concavity-detail');
const observationCount = $('#observation-count');
const chartHeading = $('#chart-heading');
const seriesVisibility = { actual: true, quadratic: true, linear: true };
const SVG_NS = 'http://www.w3.org/2000/svg';
const CHART = { width: 1000, height: 470, left: 76, right: 18, top: 22, bottom: 46 };
const mobileChartQuery = window.matchMedia('(max-width: 600px)');
let mobileChartMode = mobileChartQuery.matches;
let lastChartPoints = null;
let lastChartCurrency = 'USD';
let activeChartSelection = null;
const initialUrlSymbol = symbolFromUrl();
let selectedSymbol = initialUrlSymbol || 'AAPL';
let requestSequence = 0;
let companiesBySymbol = new Map();
let selectedSecurity = initialUrlSymbol ? { symbol: initialUrlSymbol, company: initialUrlSymbol, exchange: '' } : { symbol: 'AAPL', company: 'Apple Inc.' };
let sp500Companies = [];
let visibleMatches = [];
let activeMatchIndex = -1;
let searchTimer;
let searchController;
const searchResultsCache = new Map();
let userHasEditedSearch = false;
let isRefreshing = false;
tickerSearch.value = selectedSymbol;

function symbolFromUrl() {
  const value = (new URLSearchParams(window.location.search).get('symbol') || '').trim().toUpperCase();
  return TICKER_PATTERN.test(value) ? value : null;
}

function syncLocation(symbol, push) {
  const url = new URL(window.location.href);
  if (url.searchParams.get('symbol') === symbol) return;
  url.searchParams.set('symbol', symbol);
  window.history[push ? 'pushState' : 'replaceState']({ symbol }, '', url);
}

function updatePageMeta(data) {
  const name = data.company || data.symbol;
  document.title = `${data.symbol} · ${name} — Market Curve Lab`;
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute('content', `${name} (${data.symbol}): ${formatPercent(data.total_return_pct)} adjusted total return since ${data.period_start.slice(0, 4)}, ${data.best_fit} best fit, currently ${data.concavity}.`);
  }
}

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

function updateProgress(percentage, label) {
  if (loadStatus) loadStatus.textContent = label;
  if (loadProgressBar) loadProgressBar.style.width = `${percentage}%`;
  if (loadProgressTrack) loadProgressTrack.setAttribute('aria-valuenow', String(percentage));
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

function annualReturns(points) {
  const years = new Map();
  points.forEach((point, index) => {
    const year = point.date.slice(0, 4);
    if (!years.has(year)) years.set(year, { year, previous: index ? points[index - 1].performance : point.performance });
    years.get(year).end = point.performance;
  });
  return [...years.values()].map((item) => ({ ...item, rate: item.end / item.previous - 1 }));
}

function renderAnnualReturnBars(points) {
  if (!activeChartSelection) return;
  const returns = annualReturns(points);
  const { chartHeight, margins, plotRight, baselineY, x } = activeChartSelection;
  const bandHeight = mobileChartMode ? 142 : 104;
  const bandGap = mobileChartMode ? 22 : 20;
  const annualBaseline = baselineY + bandGap + bandHeight * .5;
  const annualHalfHeight = bandHeight * .44;
  const maxRate = Math.max(.1, ...returns.map((item) => Math.abs(item.rate)));
  const rateY = (rate) => annualBaseline - rate / maxRate * annualHalfHeight;
  const barWidth = Math.max(4, Math.min(18, (plotRight - margins.left) / (points.length - 1) * 5));
  const formatRate = (rate) => `${rate >= 0 ? '+' : '−'}${Math.abs(rate * 100).toFixed(1)}%`;
  const layer = svgElement('g', { class: 'annual-returns-layer' });
  const defs = chart.querySelector('defs');
  const gainGradient = svgElement('linearGradient', { id: 'annual-gain-fill', x1: '0', x2: '0', y1: '0', y2: '1' });
  gainGradient.append(svgElement('stop', { offset: '0%', 'stop-color': '#d3ef83', 'stop-opacity': '.8' }), svgElement('stop', { offset: '100%', 'stop-color': '#83d0a5', 'stop-opacity': '.45' }));
  const lossGradient = svgElement('linearGradient', { id: 'annual-loss-fill', x1: '0', x2: '0', y1: '0', y2: '1' });
  lossGradient.append(svgElement('stop', { offset: '0%', 'stop-color': '#ee9382', 'stop-opacity': '.45' }), svgElement('stop', { offset: '100%', 'stop-color': '#efc27e', 'stop-opacity': '.8' }));
  defs.append(gainGradient, lossGradient);
  [-maxRate, 0, maxRate].forEach((rate) => {
    const y = rateY(rate);
    layer.append(
      svgElement('line', { class: rate === 0 ? 'annual-zero-line' : 'annual-grid-line', x1: margins.left, x2: plotRight, y1: y, y2: y }),
      svgElement('text', { class: 'annual-grid-label', x: margins.left - 10, y: y + 4, 'text-anchor': 'end' }, formatRate(rate)),
    );
  });
  layer.append(svgElement('text', { class: 'annual-axis-title', x: margins.left, y: annualBaseline - annualHalfHeight - 10 }, 'ANNUAL RETURN · %'));
  returns.forEach((item) => {
    const pointIndex = points.findIndex((point) => point.date.startsWith(item.year));
    const centerX = x(pointIndex < 0 ? 0 : pointIndex);
    const endY = rateY(item.rate);
    const bar = svgElement('rect', {
      class: `annual-bar ${item.rate >= 0 ? 'annual-bar-positive' : 'annual-bar-negative'}`,
      x: centerX - barWidth / 2,
      y: Math.min(annualBaseline, endY),
      width: barWidth,
      height: Math.max(1, Math.abs(endY - annualBaseline)),
      rx: Math.min(3, barWidth / 3),
    });
    bar.append(svgElement('title', {}, `${item.year}: ${formatRate(item.rate)}`));
    layer.append(bar);
  });
  chart.append(layer);
}

function formatAnnualReturn(rate) {
  return `${rate >= 0 ? '+' : '−'}${Math.abs(rate * 100).toFixed(1)}%`;
}

function renderChart(points, currency = lastChartCurrency) {
  lastChartPoints = points;
  lastChartCurrency = currency;
  const chartHeight = mobileChartMode ? 660 : CHART.height;
  const annualBandHeight = mobileChartMode ? 142 : 104;
  const annualBandGap = mobileChartMode ? 22 : 20;
  const margins = mobileChartMode
    ? { left: 120, right: 24, top: 74, bottom: 58 }
    : { left: CHART.left, right: CHART.right, top: CHART.top, bottom: CHART.bottom };
  const plotRight = CHART.width - margins.right;
  chart.setAttribute('viewBox', `0 0 ${CHART.width} ${chartHeight}`);
  const maxValue = Math.max(...points.map((point) => point.performance));
  const minExponent = 2;
  const maxExponent = Math.ceil(Math.log10(maxValue));
  const plotWidth = plotRight - margins.left;
  const plotHeight = chartHeight - margins.top - margins.bottom - annualBandHeight - annualBandGap;
  const minLog = minExponent;
  const maxLog = Math.max(maxExponent, minExponent + 1);
  const x = (index) => margins.left + (index / (points.length - 1)) * plotWidth;
  const y = (value) => margins.top + (1 - (Math.log10(Math.max(10 ** minExponent, value)) - minLog) / (maxLog - minLog)) * plotHeight;
  const makePath = (key) => points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)},${y(point[key]).toFixed(2)}`).join(' ');
  chart.setAttribute('aria-label', 'Selected company indexed performance on a logarithmic scale with linear and quadratic trendlines. Click the graph to inspect monthly values.');

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
      svgElement('line', { class: 'grid-line', x1: margins.left, x2: plotRight, y1: tickY, y2: tickY }),
      svgElement('text', { class: 'chart-grid-label', x: margins.left - 12, y: tickY + 3, 'text-anchor': 'end' }, formatIndex(tickValue)),
    );
  }

  const baselineY = chartHeight - margins.bottom - annualBandHeight;
  chart.append(svgElement('line', { class: 'chart-axis', x1: margins.left, x2: plotRight, y1: baselineY, y2: baselineY }));
  chart.append(svgElement('text', {
    class: 'performance-axis-title',
    x: margins.left,
    y: margins.top - (mobileChartMode ? 30 : 12),
  }, 'INDEXED VALUE · $100 START'));
  for (let tick = 0; tick <= 4; tick += 1) {
    const index = Math.round(tick * (points.length - 1) / 4);
    chart.append(svgElement('text', {
      class: 'chart-date-label',
      x: x(index),
      y: chartHeight - 13,
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

  const selectionLayer = svgElement('g', { class: 'chart-selection-layer', 'aria-hidden': 'true', 'pointer-events': 'none' });
  const pointRadius = mobileChartMode ? 10 : 5;
  const crosshair = svgElement('line', { class: 'chart-selection-crosshair', x1: margins.left, x2: margins.left, y1: margins.top, y2: baselineY });
  const performancePoint = svgElement('circle', { class: 'chart-selection-point chart-selection-performance', cx: margins.left, cy: margins.top, r: pointRadius });
  const tooltipWidth = mobileChartMode ? 580 : 270;
  const tooltipHeight = mobileChartMode ? 156 : 72;
  const tooltip = svgElement('g', { class: 'chart-selection-tooltip' });
  const textScale = mobileChartMode ? 2.2 : 1;
  const selectedDate = svgElement('text', { class: 'chart-selection-date', x: 12 * textScale, y: 20 * textScale });
  const selectedPerformance = svgElement('text', { class: 'chart-selection-performance-text', x: 12 * textScale, y: 42 * textScale });
  const selectedAnnualReturn = svgElement('text', { class: 'chart-selection-annual-return', x: 12 * textScale, y: 64 * textScale });
  tooltip.append(
    svgElement('rect', { class: 'chart-selection-tooltip-bg', width: tooltipWidth, height: tooltipHeight, rx: mobileChartMode ? 14 : 8 }),
    selectedDate,
    selectedPerformance,
    selectedAnnualReturn,
  );
  selectionLayer.append(crosshair, performancePoint, tooltip);
  selectionLayer.style.display = 'none';
  chart.append(selectionLayer);
  activeChartSelection = {
    points, currency, chartHeight, margins, plotWidth, plotRight, baselineY, x, y, selectionLayer, crosshair,
    performancePoint, tooltip, selectedDate, selectedPerformance, selectedAnnualReturn, tooltipWidth, tooltipHeight,
    annualReturnsByYear: new Map(annualReturns(points).map((item) => [item.year, item.rate])),
  };

  chart.querySelectorAll('.series-toggle').forEach((series) => {
    series.style.display = seriesVisibility[series.dataset.series] ? '' : 'none';
  });
  renderAnnualReturnBars(points);
}

function selectChartPoint(event) {
  const state = activeChartSelection;
  if (!state) return;
  const bounds = chart.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const chartX = ((event.clientX - bounds.left) / bounds.width) * CHART.width;
  const chartY = ((event.clientY - bounds.top) / bounds.height) * state.chartHeight;
  const minX = state.margins.left;
  const maxX = state.plotRight;
  if (chartX < minX || chartX > maxX || chartY < state.margins.top || chartY > state.chartHeight - state.margins.bottom) return;

  let index = 0;
  let nearestXDistance = Infinity;
  state.points.forEach((candidate, candidateIndex) => {
    const candidateX = state.x(candidateIndex);
    const distance = Math.abs(candidateX - chartX);
    if (distance < nearestXDistance) {
      nearestXDistance = distance;
      index = candidateIndex;
    }
  });

  const point = state.points[index];
  const selectedX = state.x(index);
  const performanceY = state.y(point.performance);
  const tooltipX = selectedX + state.tooltipWidth + 14 > maxX
    ? Math.max(minX, selectedX - state.tooltipWidth - 14)
    : selectedX + 14;
  const preferredTooltipY = performanceY - state.tooltipHeight - 12;
  const tooltipY = preferredTooltipY < state.margins.top ? performanceY + 12 : preferredTooltipY;
  const boundedTooltipY = Math.min(state.baselineY - state.tooltipHeight, Math.max(state.margins.top, tooltipY));

  state.crosshair.setAttribute('x1', String(selectedX));
  state.crosshair.setAttribute('x2', String(selectedX));
  state.performancePoint.setAttribute('cx', String(selectedX));
  state.performancePoint.setAttribute('cy', String(performanceY));
  state.tooltip.setAttribute('transform', `translate(${tooltipX}, ${boundedTooltipY})`);
  state.selectedDate.textContent = point.date;
  state.selectedPerformance.textContent = `Performance: ${formatMoney(point.performance, state.currency)} per $100`;
  const year = point.date.slice(0, 4);
  const yearReturn = state.annualReturnsByYear.get(year);
  state.selectedAnnualReturn.classList.toggle('annual-return-positive', yearReturn != null && yearReturn >= 0);
  state.selectedAnnualReturn.classList.toggle('annual-return-negative', yearReturn != null && yearReturn < 0);
  state.selectedAnnualReturn.textContent = yearReturn == null ? `Annual return (${year}): unavailable` : `Annual return (${year}): ${formatAnnualReturn(yearReturn)}`;
  state.selectionLayer.style.display = '';
}

chart.addEventListener('click', selectChartPoint);
document.addEventListener('click', (event) => {
  if (chart.contains(event.target) || !activeChartSelection) return;
  activeChartSelection.selectionLayer.style.display = 'none';
});

window.addEventListener('resize', () => {
  const nextMobileChartMode = mobileChartQuery.matches;
  if (nextMobileChartMode === mobileChartMode) return;
  mobileChartMode = nextMobileChartMode;
  if (lastChartPoints) renderChart(lastChartPoints, lastChartCurrency);
});

function renderAnalysis(data) {
  const currency = data.currency || 'USD';
  tickerCompany.textContent = data.company || data.symbol;
  tickerSymbol.textContent = data.market_cap_rank
    ? `${data.symbol} · S&P RANK #${data.market_cap_rank}`
    : `${data.symbol}${data.exchange ? ` · ${data.exchange}` : ''}`;
  companyRank.textContent = data.market_cap_rank ? `S&P #${data.market_cap_rank}` : 'ANY LISTED STOCK';
  tickerPrice.textContent = formatMoney(data.latest_price, currency);
  tickerCurrency.textContent = `${currency} · LATEST QUOTE`;
  dataAsOf.textContent = `As of ${data.period_end}`;
  totalReturn.textContent = formatPercent(data.total_return_pct);
  historyPeriod.textContent = `${data.period_start} — ${data.period_end} · total return`;
  bestFitLabel.textContent = `${data.best_fit} curve`;
  const rSquared = data.best_fit === 'quadratic' ? data.quadratic_r_squared : data.linear_r_squared;
  fitQuality.textContent = `R² ${(rSquared * 100).toFixed(1)}% · ${data.observations} monthly observations`;

  const direction = data.concavity === 'concave up' ? 'up' : 'down';
  concavityCard.dataset.direction = direction;
  concavityLabel.textContent = data.concavity;
  concavitySymbol.textContent = direction === 'up' ? '⌣' : '⌒';
  concavityDetail.textContent = `Recent quadratic fit · ${data.concavity_window_months} monthly observations`;
  observationCount.textContent = `${data.observations} POINTS`;
  chartHeading.textContent = `${data.company || data.symbol}: the shape of its climb`;
  updatePageMeta(data);

  renderChart(data.points, currency);
  loadingPanel.hidden = true;
  errorPanel.hidden = true;
  chart.removeAttribute('hidden');
}

async function loadAnalysis(security, { forceRefresh = false, prefetchedCache, pushHistory = false } = {}) {
  const symbol = typeof security === 'string' ? security : security.symbol;
  selectedSymbol = symbol;
  syncLocation(symbol, pushHistory);
  selectedSecurity = typeof security === 'string' ? companiesBySymbol.get(symbol) || { symbol } : security;
  const requestId = ++requestSequence;
  const selectedCompany = selectedSecurity;
  if (selectedCompany) {
    tickerCompany.textContent = selectedCompany.company;
    tickerSymbol.textContent = selectedCompany.rank
      ? `${symbol} · S&P RANK #${selectedCompany.rank}`
      : `${symbol}${selectedCompany.exchange ? ` · ${selectedCompany.exchange}` : ''}`;
    companyRank.textContent = selectedCompany.rank ? `S&P #${selectedCompany.rank}` : 'ANY LISTED STOCK';
    chartHeading.textContent = `${selectedCompany.company}: the shape of its climb`;
  }
  loadingPanel.hidden = false;
  errorPanel.hidden = true;
  chart.setAttribute('hidden', '');
  loadingTitle.textContent = `Loading ${symbol}`;
  const cacheId = `analysis:${symbol}`;
  try {
    if (!forceRefresh) {
      updateProgress(60, `Checking saved ${symbol} history…`);
      const cached = prefetchedCache !== undefined ? prefetchedCache : await loadCachedRow(cacheId);
      if (requestId !== requestSequence) return;
      if (cached) {
        updateProgress(100, `Using saved ${symbol} results`);
        renderAnalysis(cached.payload);
        updateCacheNote(cached.updatedAt);
        return;
      }
    } else {
      updateProgress(20, `Refreshing ${symbol}…`);
    }
    updateProgress(75, `Loading ${symbol} price history…`);
    const params = new URLSearchParams({ symbol });
    if (selectedCompany?.company) params.set('company', selectedCompany.company);
    if (selectedCompany?.exchange) params.set('exchange', selectedCompany.exchange);
    // Passing along rank/market_cap (already known client-side) lets the API skip the Nasdaq screener call.
    if (selectedCompany?.rank) params.set('rank', String(selectedCompany.rank));
    if (selectedCompany?.market_cap != null) params.set('market_cap', String(selectedCompany.market_cap));
    const response = await fetch(`${API}/analysis?${params}`, { headers: { Accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Could not load ${symbol} history.`);
    if (requestId !== requestSequence) return;
    updateProgress(95, `Fitting ${symbol} trendlines…`);
    renderAnalysis(data);
    updateCacheNote(Date.now());
    saveCachedRow(cacheId, data);
  } catch (error) {
    if (requestId !== requestSequence) return;
    loadingPanel.hidden = true;
    errorPanel.hidden = false;
    errorCopy.textContent = error instanceof Error ? error.message : `Could not load ${symbol} history.`;
  }
}

function updateCacheNote(timestamp) {
  if (!cacheNote) return;
  cacheNote.textContent = timestamp ? `Saved results · ${formatRelativeTime(timestamp)}` : '';
}

async function loadCompanies(forceRefresh = false) {
  // Kicked off alongside the companies lookup below (not awaited yet) so the two independent
  // cache reads happen in parallel instead of one waiting on the other.
  const analysisPrefetch = forceRefresh ? null : loadCachedRow(`analysis:${selectedSymbol}`);
  try {
    let companiesPayload = null;
    let cacheTimestamp = null;
    if (!forceRefresh) {
      updateProgress(10, 'Checking saved results…');
      const cached = await loadCachedRow('companies');
      if (cached) {
        companiesPayload = cached.payload.companies;
        cacheTimestamp = cached.updatedAt;
      }
    }
    if (!companiesPayload) {
      updateProgress(45, 'Loading S&P 500 rankings…');
      const response = await fetch(`${API}/companies`, { headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load S&P 500 company rankings.');
      companiesPayload = payload.companies || [];
      cacheTimestamp = Date.now();
      saveCachedRow('companies', { companies: companiesPayload });
    }
    sp500Companies = companiesPayload;
    companiesBySymbol = new Map(sp500Companies.map((company) => [company.symbol, company]));
    updateCacheNote(cacheTimestamp);
    const prefetchedCache = await analysisPrefetch;
    if (userHasEditedSearch) {
      const selectedCompany = companiesBySymbol.get(selectedSymbol);
      if (selectedCompany && tickerSearch.value.trim().toUpperCase() === selectedSymbol) {
        await loadAnalysis(selectedCompany, { forceRefresh, prefetchedCache });
        return;
      }
      await searchTicker(tickerSearch.value);
      return;
    }
    const preferred = companiesBySymbol.get(selectedSymbol)
      || (initialUrlSymbol === selectedSymbol ? selectedSecurity : sp500Companies[0]);
    if (!preferred) throw new Error('No S&P 500 companies were returned by the market-data provider.');
    tickerSearch.value = preferred.symbol;
    await loadAnalysis(preferred, { forceRefresh, prefetchedCache });
  } catch (error) {
    // The ticker-search endpoint still allows any listed stock if the ranking feed is unavailable.
    companyRank.textContent = 'SEARCH ANY STOCK';
    await searchTicker(tickerSearch.value || 'AAPL');
    if (!userHasEditedSearch) {
      const prefetchedCache = forceRefresh ? undefined : await analysisPrefetch;
      await loadAnalysis({ symbol: selectedSymbol, company: selectedSymbol, exchange: '' }, { forceRefresh, prefetchedCache });
    }
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
  loadAnalysis(security, { pushHistory: true });
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

  const cacheKey = normalizedQuery.toLowerCase();
  const cachedResults = searchResultsCache.get(cacheKey);
  if (cachedResults) {
    renderSearchResults(combineSearchMatches(normalizedQuery, cachedResults));
    return;
  }
  renderSearchResults([], 'Searching listed stocks…');

  try {
    const response = await fetch(`${API}/search?q=${encodeURIComponent(normalizedQuery)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Stock search is unavailable.');

    const results = payload.results || [];
    if (searchResultsCache.size >= 50) searchResultsCache.delete(searchResultsCache.keys().next().value);
    searchResultsCache.set(cacheKey, results);
    renderSearchResults(combineSearchMatches(normalizedQuery, results));
  } catch (error) {
    if (error.name === 'AbortError') return;
    const queryLower = normalizedQuery.toLowerCase();
    const localMatches = sp500Companies.filter((company) =>
      company.symbol.includes(normalizedQuery.toUpperCase()) || company.company.toLowerCase().includes(queryLower),
    );
    renderSearchResults(localMatches.slice(0, 10), localMatches.length ? '' : error instanceof Error ? error.message : 'Stock search is unavailable.');
  }
}

function combineSearchMatches(query, remoteResults) {
  const queryUpper = query.toUpperCase();
  const queryLower = query.toLowerCase();
  const rankedCompanies = sp500Companies.filter((company) =>
    company.symbol.includes(queryUpper) || company.company.toLowerCase().includes(queryLower),
  );
  const seen = new Set();
  return [...rankedCompanies, ...remoteResults].filter((security) => {
    if (seen.has(security.symbol)) return false;
    seen.add(security.symbol);
    return true;
  }).slice(0, 10);
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
  const query = tickerSearch.value.trim();
  if (!query) {
    renderSearchResults(sp500Companies.slice(0, 8));
    return;
  }
  const localMatches = combineSearchMatches(query, []);
  if (localMatches.length) renderSearchResults(localMatches);
  else if (selectedSecurity?.symbol === query.toUpperCase()) renderSearchResults([selectedSecurity]);
  else searchTicker(query);
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

$('#retry-button').addEventListener('click', () => {
  loadAnalysis(selectedSecurity);
});
window.addEventListener('popstate', () => {
  const symbol = symbolFromUrl() || 'AAPL';
  if (symbol === selectedSymbol) return;
  tickerSearch.value = symbol;
  closeSearchResults();
  loadAnalysis(companiesBySymbol.get(symbol) || { symbol, company: symbol, exchange: '' });
});
if (shareButton) {
  shareButton.addEventListener('click', async () => {
    const encodedSymbol = encodeURIComponent(selectedSymbol);
    const url = companiesBySymbol.has(selectedSymbol)
      ? `${PAGES_APP_URL}s/${encodedSymbol}/`
      : `${VERCEL_SHARE_URL}${encodedSymbol}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      if (cacheNote) cacheNote.textContent = `Link copied · ${url}`;
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (cacheNote) cacheNote.textContent = url;
    }
  });
}
if (refreshButton) {
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
}
loadCompanies();
