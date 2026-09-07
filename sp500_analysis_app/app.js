const API = 'https://api.nasdaq.com/api';
const WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'AVGO', 'JPM', 'LLY', 'V', 'XOM', 'COST', 'WMT', 'ORCL', 'NFLX', 'AMD'];
const COMPANY_SITES = { AAPL: 'https://www.apple.com', MSFT: 'https://www.microsoft.com', NVDA: 'https://www.nvidia.com', AMZN: 'https://www.amazon.com', GOOGL: 'https://abc.xyz', META: 'https://about.meta.com', AVGO: 'https://www.broadcom.com', JPM: 'https://www.jpmorganchase.com', LLY: 'https://www.lilly.com', V: 'https://usa.visa.com', XOM: 'https://corporate.exxonmobil.com', COST: 'https://www.costco.com', WMT: 'https://corporate.walmart.com', ORCL: 'https://www.oracle.com', NFLX: 'https://www.netflix.com', AMD: 'https://www.amd.com' };

const $ = (selector) => document.querySelector(selector);
const elements = { body: $('#ranking-body'), refresh: $('#refresh-button'), updated: $('#last-updated'), status: $('#market-status'), count: $('#scan-count'), detailTitle: $('#detail-title'), detailSignal: $('#detail-signal'), description: $('#detail-description'), price: $('#detail-price'), change: $('#detail-change'), marketCap: $('#detail-market-cap'), range: $('#detail-range'), volume: $('#detail-volume'), pe: $('#detail-pe'), rationale: $('#rationale-list'), period: $('#financial-period'), revenue: $('#financial-revenue'), income: $('#financial-income'), margin: $('#financial-margin'), cash: $('#financial-cash'), companyLink: $('#company-link'), secLink: $('#sec-link') };
let results = [];
let selectedSymbol = null;

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
  const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
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
  return { symbol, name: info.companyName || chartPrimary.company || symbol, exchange: info.exchange || chartPrimary.exchange || '--', price, dayChange, previousClose, volume, marketCap, pe, range: high52 && low52 ? `${fmtPrice(low52)} – ${fmtPrice(high52)}` : range, high52, low52, oneYearChange, monthChange, rangePosition, info, chart: chartPrimary };
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

function renderSummary() {
  const buckets = { Buy: results.filter((item) => item.signal === 'Buy').sort((a, b) => b.score - a.score), Hold: results.filter((item) => item.signal === 'Hold').sort((a, b) => Math.abs(50 - a.score) - Math.abs(50 - b.score)), Sell: results.filter((item) => item.signal === 'Sell').sort((a, b) => a.score - b.score) };
  [['Buy', buckets.Buy[0], 'buy'], ['Hold', buckets.Hold[0], 'hold'], ['Sell', buckets.Sell[0], 'sell']].forEach(([signal, item, prefix]) => { $(`#${prefix}-symbol`).textContent = item?.symbol || '--'; $(`#${prefix}-name`).textContent = item?.name || 'No signal available'; $(`#${prefix}-score`).textContent = item ? item.score : '--'; });
}

function renderTable() {
  elements.count.textContent = `${results.length} / ${WATCHLIST.length} loaded`;
  if (!results.length) { elements.body.innerHTML = '<tr><td colspan="6" class="loading-cell">No market data returned. Try refreshing.</td></tr>'; return; }
  elements.body.innerHTML = results.slice().sort((a, b) => b.score - a.score).map((item, index) => `<tr data-symbol="${item.symbol}" tabindex="0" class="${item.symbol === selectedSymbol ? 'selected' : ''}"><td class="rank">${String(index + 1).padStart(2, '0')}</td><td class="company-cell"><strong>${escapeHtml(item.symbol)}</strong><span>${escapeHtml(item.name)}</span></td><td class="signal-text ${signalClass(item.signal)}">${item.signal}</td><td class="num">${fmtPrice(item.price)}</td><td class="num ${changeClass(item.dayChange)}">${changeText(item.dayChange)}</td><td class="num">${item.score}</td></tr>`).join('');
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
  await loadFinancials(item);
}

async function runScan() {
  elements.refresh.disabled = true;
  elements.status.textContent = 'Refreshing market data';
  elements.body.innerHTML = '<tr><td colspan="6" class="loading-cell">Loading market data<span class="loader"></span></td></tr>';
  const settled = await Promise.allSettled(WATCHLIST.map(async (symbol) => { const [info, chart] = await Promise.all([getJson(`/quote/${symbol}/info?assetclass=stocks`), getJson(`/quote/${symbol}/chart?assetclass=stocks`)]); return scoreQuote(parseQuote(symbol, info, chart)); }));
  results = settled.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value);
  renderSummary();
  renderTable();
  if (results.length) await selectCompany(selectedSymbol && results.some((item) => item.symbol === selectedSymbol) ? selectedSymbol : results[0].symbol);
  elements.status.textContent = results.length ? 'Live data connected' : 'Data unavailable';
  elements.updated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  elements.refresh.disabled = false;
}

elements.refresh.addEventListener('click', runScan);
runScan();
