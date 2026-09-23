const VERCEL_API = 'https://sp-six-gamma.vercel.app/api';
const API = window.location.hostname.endsWith('github.io') ? VERCEL_API : '/api';
const CONSTITUENTS_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv';
const TOP_N_PER_SIGNAL = 20;
// Used only if the live S&P 500 constituent list can't be fetched (offline, blocked, etc.)
const FALLBACK_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'AVGO', 'JPM', 'LLY', 'V', 'XOM', 'COST', 'WMT', 'ORCL', 'NFLX', 'AMD', 'MA', 'PG', 'HD', 'ABBV', 'KO', 'BAC', 'UNH', 'CRM', 'CVX', 'MRK', 'TMO', 'PEP', 'ADBE', 'ACN', 'MCD', 'CSCO', 'ABT', 'LIN', 'WFC', 'TXN', 'DIS', 'IBM', 'PM', 'GE', 'CAT', 'INTU', 'AXP', 'VZ', 'NOW', 'QCOM', 'AMGN', 'PFE', 'UBER', 'SPGI'];
let WATCHLIST = FALLBACK_WATCHLIST.slice();
const COMPANY_SITES = { AAPL: 'https://www.apple.com', MSFT: 'https://www.microsoft.com', NVDA: 'https://www.nvidia.com', AMZN: 'https://www.amazon.com', GOOGL: 'https://abc.xyz', META: 'https://about.meta.com', AVGO: 'https://www.broadcom.com', JPM: 'https://www.jpmorganchase.com', LLY: 'https://www.lilly.com', V: 'https://usa.visa.com', XOM: 'https://corporate.exxonmobil.com', COST: 'https://www.costco.com', WMT: 'https://corporate.walmart.com', ORCL: 'https://www.oracle.com', NFLX: 'https://www.netflix.com', AMD: 'https://www.amd.com', MA: 'https://www.mastercard.com', PG: 'https://us.pg.com', HD: 'https://corporate.homedepot.com', ABBV: 'https://www.abbvie.com', KO: 'https://www.coca-colacompany.com', BAC: 'https://www.bankofamerica.com', UNH: 'https://www.unitedhealthgroup.com', CRM: 'https://www.salesforce.com', CVX: 'https://www.chevron.com', MRK: 'https://www.merck.com', TMO: 'https://www.thermofisher.com', PEP: 'https://www.pepsico.com', ADBE: 'https://www.adobe.com', ACN: 'https://www.accenture.com', MCD: 'https://www.mcdonalds.com', CSCO: 'https://www.cisco.com', ABT: 'https://www.abbott.com', LIN: 'https://www.linde.com', WFC: 'https://www.wellsfargo.com', TXN: 'https://www.ti.com', DIS: 'https://www.thewaltdisneycompany.com', IBM: 'https://www.ibm.com', PM: 'https://www.pmi.com', GE: 'https://www.ge.com', CAT: 'https://www.caterpillar.com', INTU: 'https://www.intuit.com', AXP: 'https://www.americanexpress.com', VZ: 'https://www.verizon.com', NOW: 'https://www.servicenow.com', QCOM: 'https://www.qualcomm.com', AMGN: 'https://www.amgen.com', PFE: 'https://www.pfizer.com', UBER: 'https://www.uber.com', SPGI: 'https://www.spglobal.com' };

const $ = (selector) => document.querySelector(selector);
const elements = { body: $('#ranking-body'), refresh: $('#refresh-button'), updated: $('#last-updated'), status: $('#market-status'), count: $('#scan-count'), progressStatus: $('#progress-status'), progressCount: $('#progress-count'), progressBar: $('#progress-bar'), progressTrack: $('.progress-track'), detailTitle: $('#detail-title'), detailSignal: $('#detail-signal'), description: $('#detail-description'), price: $('#detail-price'), change: $('#detail-change'), marketCap: $('#detail-market-cap'), range: $('#detail-range'), volume: $('#detail-volume'), pe: $('#detail-pe'), performanceChange: $('#performance-change'), performanceChart: $('#performance-chart'), chartStart: $('#chart-start'), chartEnd: $('#chart-end'), rangeTabs: document.querySelectorAll('.range-tab'), rationale: $('#rationale-list'), period: $('#financial-period'), revenue: $('#financial-revenue'), income: $('#financial-income'), margin: $('#financial-margin'), cash: $('#financial-cash'), companyLink: $('#company-link'), secLink: $('#sec-link') };
let results = [];
let selectedSymbol = null;
let selectedRange = '1d';
let chartRequestId = 0;

const CACHE_KEY = 'sp500-analysis-cache-v1';

// Drops the raw quote/chart payloads (info, chart, performanceCharts) before caching, since storing
// them for the full universe of companies exceeds localStorage's quota and silently fails to save
function slimResult({ info, chart, performanceCharts, ...rest }) {
  return rest;
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ results: results.map(slimResult), selectedSymbol, watchlist: WATCHLIST, timestamp: Date.now() }));
  } catch (error) {
    // storage may be unavailable (e.g. private browsing) or still over quota; nothing to do
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function updateProgress(completed, total, label = 'Assessing constituents') {
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  elements.progressStatus.textContent = label;
  elements.progressCount.textContent = `${completed} / ${total}`;
  elements.progressBar.style.width = `${percentage}%`;
  elements.progressTrack.setAttribute('aria-valuenow', String(percentage));
}

const PERFORMANCE_RANGES = { '1d': { label: '1D' }, '1w': { label: '1W', days: 7 }, '1m': { label: '1M', days: 30 }, ytd: { label: 'YTD', ytd: true }, '1y': { label: '1Y', days: 365 }, '5y': { label: '5Y', days: 1825 }, '10y': { label: '10Y', days: 3650 }, all: { label: 'All', all: true } };

function rangeStart(range) {
  const date = new Date();
  if (range.all) return '1970-01-01';
  if (range.ytd) return `${date.getUTCFullYear()}-01-01`;
  date.setUTCDate(date.getUTCDate() - range.days);
  return date.toISOString().slice(0, 10);
}

function setActiveRange(range) {
  selectedRange = range;
  elements.rangeTabs.forEach((tab) => { const active = tab.dataset.range === range; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
}

function renderPerformanceChart(points, range) {
  const validPoints = points.map((point) => ({ x: Number(point.x), y: numberFromText(point.y) })).filter((point) => Number.isFinite(point.x) && point.y !== null && point.y > 0);
  if (validPoints.length < 2) { elements.performanceChart.innerHTML = '<span class="chart-placeholder">Performance data unavailable for this range.</span>'; elements.performanceChange.textContent = '--'; elements.chartStart.textContent = elements.chartEnd.textContent = '--'; return; }
  const sampled = validPoints.length > 240 ? validPoints.filter((_, index) => index % Math.ceil(validPoints.length / 240) === 0 || index === validPoints.length - 1) : validPoints;
  const first = sampled[0].y;
  const normalized = sampled.map((point) => ({ ...point, value: (point.y / first) * 100 }));
  const values = normalized.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.12, 1);
  const low = min - padding;
  const high = max + padding;
  const width = 640;
  const height = 220;
  const coords = normalized.map((point, index) => `${(index / (normalized.length - 1)) * width},${height - ((point.value - low) / (high - low)) * height}`).join(' ');
  const change = normalized.at(-1).value - 100;
  const changeClassName = changeClass(change);
  elements.performanceChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  elements.performanceChange.className = changeClassName;
  elements.chartStart.textContent = new Date(validPoints[0].x).toLocaleDateString([], { month: 'short', day: 'numeric', year: range === 'all' || range === '10y' ? 'numeric' : undefined });
  elements.chartEnd.textContent = new Date(validPoints.at(-1).x).toLocaleDateString([], { month: 'short', day: 'numeric', year: range === 'all' || range === '10y' ? 'numeric' : undefined });
  elements.performanceChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${PERFORMANCE_RANGES[range].label} performance chart"><line class="chart-baseline" x1="0" y1="${height - ((100 - low) / (high - low)) * height}" x2="${width}" y2="${height - ((100 - low) / (high - low)) * height}" /><polyline class="chart-line ${changeClassName}" points="${coords}" /></svg>`;
}

async function loadPerformanceChart(item, range = selectedRange) {
  const requestId = ++chartRequestId;
  elements.performanceChart.innerHTML = '<span class="chart-placeholder">Loading performance...</span>';
  elements.performanceChange.textContent = '--';
  if (range === '1d') {
    const currentPrice = item.price;
    const previousClose = item.previousClose;
    if (currentPrice && previousClose) {
      renderPerformanceChart([{ x: Date.now() - 86400000, y: previousClose }, { x: Date.now(), y: currentPrice }], range);
    } else {
      elements.performanceChart.innerHTML = '<span class="chart-placeholder">End-of-day data unavailable.</span>';
    }
    return;
  }
  const cachedChart = item.performanceCharts?.[range];
  if (cachedChart) {
    renderPerformanceChart(cachedChart.chart || [], range);
    return;
  }
  const query = `&fromdate=${rangeStart(PERFORMANCE_RANGES[range])}`;
  try {
    const chart = await getJson(`/quote/${item.symbol}/chart?assetclass=stocks${query}`);
    item.performanceCharts = { ...(item.performanceCharts || {}), [range]: chart };
    if (requestId === chartRequestId && selectedSymbol === item.symbol) renderPerformanceChart(chart.chart || [], range);
  } catch (error) {
    if (requestId === chartRequestId) elements.performanceChart.innerHTML = '<span class="chart-placeholder">Performance data unavailable.</span>';
  }
}

const numberFromText = (value) => {
  if (typeof value === 'number') return value;
  if (!value) return null;
  const cleaned = String(value).replace(/[$,%BMTK,]/g, '').trim();
  const number = Number(cleaned);
  if (!Number.isFinite(number)) return null;
  if (String(value).includes('T')) return number * 1e12;
  if (String(value).includes('B')) return number * 1e9;
  if (String(value).includes('M')) return number * 1e6;
  if (String(value).includes('K')) return number * 1e3;
  return number;
};
const fmtMoney = (value) => { const number = numberFromText(value); if (number === null) return '--'; if (Math.abs(number) >= 1e12) return `$${(number / 1e12).toFixed(2)}T`; if (Math.abs(number) >= 1e9) return `$${(number / 1e9).toFixed(2)}B`; if (Math.abs(number) >= 1e6) return `$${(number / 1e6).toFixed(1)}M`; return `$${number.toLocaleString()}`; };
const fmtNumber = (value) => { const number = numberFromText(value); return number === null ? '--' : number.toLocaleString(); };
const fmtPrice = (value) => { const number = numberFromText(value); return number === null ? '--' : `$${number.toFixed(2)}`; };
const pct = (value) => { const number = numberFromText(value); return number === null ? null : number; };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

async function getJson(path) {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${API}${path}${separator}_=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Market data request failed: ${response.status}`);
  const payload = await response.json();
  if (!payload.data) throw new Error('Market data was empty');
  return payload.data;
}

function parseQuote(symbol, info, chart) {
  const primary = info.primaryData || {};
  const stats = info.keyStats || {};
  const chartPrimary = chart || {};
  const price = numberFromText(primary.lastSalePrice || chartPrimary.lastSalePrice);
  const dayChange = pct(primary.percentageChange || chartPrimary.percentageChange);
  const previousClose = numberFromText(primary.previousClose || chartPrimary.previousClose);
  const range = stats.fiftyTwoWeekHighLow?.value || stats['52WeekHighLow'] || '--';
  const rangeNumbers = String(range).match(/[\d.]+/g) || [];
  const high52 = numberFromText(rangeNumbers[1]);
  const low52 = numberFromText(rangeNumbers[0]);
  const marketCap = stats.marketCap || stats['Market Cap'] || stats.marketCapitalization;
  const pe = stats.forwardPE || stats.peRatio || stats.PERatio || stats['P/E Ratio'];
  const volume = primary.volume || chartPrimary.volume;
  const history = (chartPrimary.chart || []).map((item) => numberFromText(item.y)).filter((item) => item !== null);
  const oneYearChange = history.length > 20 ? ((history.at(-1) / history[0]) - 1) * 100 : null;
  const monthChange = history.length > 20 ? ((history.at(-1) / history[Math.max(0, history.length - 21)]) - 1) * 100 : null;
  const rangePosition = high52 && low52 && price ? ((price - low52) / (high52 - low52)) * 100 : null;
  return { symbol, name: info.companyName || chartPrimary.company || symbol, exchange: info.exchange || chartPrimary.exchange || '--', price, dayChange, previousClose, volume, marketCap, pe, range: high52 && low52 ? `${fmtPrice(low52)} – ${fmtPrice(high52)}` : range, high52, low52, oneYearChange, monthChange, rangePosition, info, chart: chartPrimary, performanceCharts: { '1y': chartPrimary } };
}

function scoreQuote(quote) {
  let score = 50;
  const reasons = [];
  if (quote.oneYearChange !== null) { score += Math.max(-20, Math.min(20, quote.oneYearChange * 0.45)); reasons.push(`${quote.oneYearChange >= 0 ? '+' : ''}${quote.oneYearChange.toFixed(1)}% over the available 1-year chart window`); }
  if (quote.monthChange !== null) { score += Math.max(-12, Math.min(12, quote.monthChange * 0.7)); reasons.push(`${quote.monthChange >= 0 ? '+' : ''}${quote.monthChange.toFixed(1)}% over the latest month`); }
  if (quote.rangePosition !== null) { score += (quote.rangePosition - 50) * 0.12; reasons.push(`trading at ${quote.rangePosition.toFixed(0)}% of its 52-week range`); }
  if (quote.dayChange !== null) { score += Math.max(-5, Math.min(5, quote.dayChange * 0.35)); }
  score = Math.round(Math.max(0, Math.min(100, score)));
  let signal = 'Hold';
  if (score >= 67) signal = 'Buy';
  if (score <= 38) signal = 'Sell';
  if (signal === 'Buy') reasons.push('trend and recent momentum clear the model\'s positive threshold');
  if (signal === 'Sell') reasons.push('trend and recent momentum fall below the model\'s risk threshold');
  if (signal === 'Hold') reasons.push('mixed or mid-range signals suggest waiting for confirmation');
  return { ...quote, score, signal, reasons };
}

function signalClass(signal) { return `signal-${signal.toLowerCase()}`; }
function changeClass(value) { return value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'; }
function changeText(value) { return value === null ? '--' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }

function signalBuckets() {
  return { Buy: results.filter((item) => item.signal === 'Buy').sort((a, b) => b.score - a.score), Hold: results.filter((item) => item.signal === 'Hold').sort((a, b) => Math.abs(50 - a.score) - Math.abs(50 - b.score)), Sell: results.filter((item) => item.signal === 'Sell').sort((a, b) => a.score - b.score) };
}

// Full universe is scored, but only the strongest N per signal are shown so the table stays readable
function selectTopSignals() {
  const buckets = signalBuckets();
  return [...buckets.Buy.slice(0, TOP_N_PER_SIGNAL), ...buckets.Hold.slice(0, TOP_N_PER_SIGNAL), ...buckets.Sell.slice(0, TOP_N_PER_SIGNAL)];
}

function renderSummary() {
  const buckets = signalBuckets();
  [['Buy', buckets.Buy[0], 'buy'], ['Hold', buckets.Hold[0], 'hold'], ['Sell', buckets.Sell[0], 'sell']].forEach(([signal, item, prefix]) => { $(`#${prefix}-symbol`).textContent = item?.symbol || '--'; $(`#${prefix}-name`).textContent = item?.name || (results.length ? `No ${signal} threshold met` : 'No market data'); $(`#${prefix}-score`).textContent = item ? item.score : '--'; });
}

function renderTable() {
  const shortlist = selectTopSignals();
  elements.count.textContent = `${results.length} / ${WATCHLIST.length} securities · 500 companies · top ${shortlist.length} shown`;
  if (!results.length) { elements.body.innerHTML = '<tr><td colspan="6" class="loading-cell">No market data returned. Try refreshing.</td></tr>'; return; }
  elements.body.innerHTML = shortlist.slice().sort((a, b) => b.score - a.score).map((item, index) => `<tr data-symbol="${item.symbol}" tabindex="0" class="${item.symbol === selectedSymbol ? 'selected' : ''}"><td class="rank">${String(index + 1).padStart(2, '0')}</td><td class="company-cell"><strong>${escapeHtml(item.symbol)}</strong><span>${escapeHtml(item.name)}</span></td><td class="signal-text ${signalClass(item.signal)}">${item.signal}</td><td class="num">${fmtPrice(item.price)}</td><td class="num ${changeClass(item.dayChange)}">${changeText(item.dayChange)}</td><td class="num">${item.score}</td></tr>`).join('');
  elements.body.querySelectorAll('tr[data-symbol]').forEach((row) => { row.addEventListener('click', () => selectCompany(row.dataset.symbol)); row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') selectCompany(row.dataset.symbol); }); });
}

async function loadFinancials(item) {
  elements.period.textContent = 'Loading';
  try {
    const financials = await getJson(`/company/${item.symbol}/financials?assetclass=stocks`);
    const incomeRows = financials.incomeStatementTable?.rows || [];
    const ratioRows = financials.financialRatiosTable?.rows || [];
    const findRow = (rows, names) => rows.find((row) => names.some((name) => String(row.value1 || row.label || row.name || row.title || '').toLowerCase().includes(name)));
    const revenue = findRow(incomeRows, ['revenue', 'total revenue']);
    const income = findRow(incomeRows, ['net income']);
    const margin = findRow(ratioRows, ['profit margin', 'operating margin']);
    const cash = findRow(financials.cashFlowTable?.rows || [], ['free cash flow', 'operating cash flow']);
    const firstValue = (row) => row ? Object.entries(row).find(([key]) => key !== 'label' && key !== 'name' && key !== 'title')?.[1] : null;
    elements.period.textContent = financials.incomeStatementTable?.asOf || 'Latest report';
    elements.revenue.textContent = fmtMoney(firstValue(revenue));
    elements.income.textContent = fmtMoney(firstValue(income));
    elements.margin.textContent = firstValue(margin) || '--';
    elements.cash.textContent = fmtMoney(firstValue(cash));
  } catch (error) {
    elements.period.textContent = 'Unavailable';
    elements.revenue.textContent = elements.income.textContent = elements.margin.textContent = elements.cash.textContent = '--';
  }
}

async function selectCompany(symbol) {
  const item = results.find((entry) => entry.symbol === symbol);
  if (!item) return;
  selectedSymbol = symbol;
  renderTable();
  elements.detailTitle.textContent = `${item.symbol} / ${item.name}`;
  elements.detailSignal.textContent = item.signal;
  elements.detailSignal.className = `signal-pill ${signalClass(item.signal)}`;
  elements.description.textContent = `${item.name} trades on ${item.exchange}. The model is based on observable price and volume behavior, not a human analyst target price.`;
  elements.price.textContent = fmtPrice(item.price);
  elements.change.textContent = changeText(item.dayChange);
  elements.change.className = changeClass(item.dayChange);
  elements.marketCap.textContent = fmtMoney(item.marketCap);
  elements.range.textContent = item.range;
  elements.volume.textContent = fmtNumber(item.volume);
  elements.pe.textContent = item.pe || '--';
  elements.rationale.innerHTML = item.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('');
  elements.companyLink.href = COMPANY_SITES[item.symbol] || '#';
  elements.secLink.href = `https://www.sec.gov/edgar/browse/?CIK=${item.symbol}`;
  setActiveRange('1d');
  loadPerformanceChart(item);
  await loadFinancials(item);
}

async function loadUniverse() {
  try {
    const response = await fetch(CONSTITUENTS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Constituent list request failed: ${response.status}`);
    const text = await response.text();
    const symbols = text.trim().split('\n').slice(1).map((line) => line.split(',')[0].trim()).filter(Boolean);
    if (symbols.length > 400) WATCHLIST = symbols;
  } catch (error) {
    // keep FALLBACK_WATCHLIST if the live S&P 500 constituent list can't be fetched
  }
}

async function runScan() {
  elements.refresh.disabled = true;
  elements.status.textContent = `Scanning ${WATCHLIST.length} S&P 500 listed securities (500 companies; this can take a few minutes)`;
  updateProgress(0, WATCHLIST.length, 'Assessing constituents');
  elements.body.innerHTML = '<tr><td colspan="6" class="loading-cell">Loading market data<span class="loader"></span></td></tr>';
  let completed = 0;
  const settled = await Promise.allSettled(WATCHLIST.map(async (symbol) => {
    try {
      const [info, chart] = await Promise.all([getJson(`/quote/${symbol}/info?assetclass=stocks`), getJson(`/quote/${symbol}/chart?assetclass=stocks&fromdate=${rangeStart(PERFORMANCE_RANGES['1y'])}`)]);
      return scoreQuote(parseQuote(symbol, info, chart));
    } finally {
      completed += 1;
      updateProgress(completed, WATCHLIST.length);
    }
  }));
  results = settled.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value);
  renderSummary();
  renderTable();
  const shortlist = selectTopSignals();
  if (results.length) await selectCompany(selectedSymbol && results.some((item) => item.symbol === selectedSymbol) ? selectedSymbol : (shortlist[0] || results[0]).symbol);
  elements.status.textContent = results.length ? 'Live data connected' : 'Live data unavailable';
  elements.updated.textContent = results.length ? `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live refresh failed';
  updateProgress(WATCHLIST.length, WATCHLIST.length, results.length ? 'Assessment complete' : 'Assessment unavailable');
  elements.refresh.disabled = false;
  if (results.length) saveCache();
}

// Restores the last ranked results from localStorage so the page shows data immediately without rescanning the market
function restoreFromCache() {
  const cache = loadCache();
  if (!cache || !Array.isArray(cache.results) || !cache.results.length) return false;
  results = cache.results;
  selectedSymbol = cache.selectedSymbol || null;
  if (Array.isArray(cache.watchlist) && cache.watchlist.length > 400) WATCHLIST = cache.watchlist;
  renderSummary();
  renderTable();
  const shortlist = selectTopSignals();
  const symbolToShow = selectedSymbol && results.some((item) => item.symbol === selectedSymbol) ? selectedSymbol : (shortlist[0] || results[0]).symbol;
  selectCompany(symbolToShow);
  elements.status.textContent = 'Showing saved results';
  elements.updated.textContent = cache.timestamp ? `Saved ${new Date(cache.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved results';
  updateProgress(WATCHLIST.length, WATCHLIST.length, 'Loaded saved results');
  return true;
}

async function init() {
  if (restoreFromCache()) return;
  elements.status.textContent = 'Loading S&P 500 constituent list';
  await loadUniverse();
  await runScan();
}

elements.refresh.addEventListener('click', runScan);
elements.rangeTabs.forEach((tab) => tab.addEventListener('click', () => { if (!selectedSymbol) return; setActiveRange(tab.dataset.range); loadPerformanceChart(results.find((item) => item.symbol === selectedSymbol), tab.dataset.range); }));
init();
