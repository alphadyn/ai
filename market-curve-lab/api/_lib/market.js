// Shared helpers for the Vercel serverless market-data endpoints.
const NASDAQ_API = 'https://api.nasdaq.com/api';
const SCREENER_URL = `${NASDAQ_API}/screener/stocks`;
const SP500_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv';
const HISTORY_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const HISTORY_START = Math.floor(Date.UTC(1980, 0, 1) / 1000);
const COMPANY_CACHE_SECONDS = 6 * 60 * 60;
const SP500_COMPANY_COUNT = 500;
const SCREENER_LIMIT = 500;
const RECENT_WINDOW_MONTHS = 24;

const NASDAQ_HEADERS = {
  Accept: 'application/json, text/csv, */*',
  'User-Agent': 'Mozilla/5.0 (compatible; TrendLab/1.0)',
  Origin: 'https://www.nasdaq.com',
  Referer: 'https://www.nasdaq.com/',
};

// Warm-instance cache only; each cold start refetches the company data.
let companyCache = { withCaps: { companies: null, expiresAt: 0 }, noCaps: { companies: null, expiresAt: 0 } };

export function normalizeSymbol(symbol) {
  return symbol.trim().toUpperCase().replace(/\./g, '-').replace(/\//g, '-');
}

export function normalizeIssuerName(name) {
  let normalized = name.replace(/\s*\((?:class|series)\s+[^)]*\)/gi, '');
  normalized = normalized.replace(/\s+(?:class|series)\s+[A-Z0-9]+$/i, '');
  return normalized.replace(/\s+/g, ' ').trim();
}

export function normalizeTicker(symbol) {
  const ticker = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9^][A-Z0-9.^=_-]{0,19}$/.test(ticker)) {
    throw new ValidationError('Enter a valid stock ticker.');
  }
  return ticker;
}

export class ValidationError extends Error {}
export class UpstreamError extends Error {}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

async function fetchScreenerPage(offset) {
  const url = new URL(SCREENER_URL);
  url.searchParams.set('tableonly', 'true');
  url.searchParams.set('limit', String(SCREENER_LIMIT));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('exchange', 'all');
  url.searchParams.set('sortColumn', 'marketCap');
  url.searchParams.set('sortOrder', 'DESC');
  const response = await fetch(url, { headers: NASDAQ_HEADERS, cache: 'no-store' });
  if (!response.ok) throw new UpstreamError(`Nasdaq screener returned HTTP ${response.status}.`);
  return response.json();
}

export async function fetchSp500Companies(forceRefresh = false, { includeMarketCaps = false } = {}) {
  const cacheBucket = includeMarketCaps ? companyCache.withCaps : companyCache.noCaps;
  const now = Date.now() / 1000;
  if (!forceRefresh && cacheBucket.companies && now < cacheBucket.expiresAt) {
    return cacheBucket.companies;
  }

  let constituentsCsv;
  try {
    const response = await fetch(SP500_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    constituentsCsv = await response.text();
  } catch (error) {
    throw new UpstreamError('Could not load the current S&P 500 constituent list.');
  }

  const [header, ...rows] = parseCsv(constituentsCsv);
  const symbolIndex = header.indexOf('Symbol');
  const securityIndex = header.indexOf('Security');
  const members = new Map();
  for (const cells of rows) {
    const symbol = normalizeSymbol(cells[symbolIndex] || '');
    const security = (cells[securityIndex] || '').trim();
    if (symbol && security) members.set(symbol, security);
  }

  const issuers = new Map();
  const issuerBySymbol = new Map();
  for (const [symbol, securityName] of members) {
    const issuerName = normalizeIssuerName(securityName);
    const issuerKey = issuerName.toLowerCase();
    issuerBySymbol.set(symbol, issuerKey);
    if (!issuers.has(issuerKey)) {
      issuers.set(issuerKey, { company: issuerName, symbol, market_cap: null, representative_market_cap: null });
    }
  }

  if (includeMarketCaps) {
    const foundSymbols = new Set();
    const collectRows = (rows) => {
      for (const row of rows || []) {
        const symbol = normalizeSymbol(String(row.symbol || ''));
        const issuerKey = issuerBySymbol.get(symbol);
        if (!issuerKey) continue;
        foundSymbols.add(symbol);
        const marketCap = parseFloat(String(row.marketCap || '').replace(/,/g, ''));
        if (!Number.isFinite(marketCap) || marketCap <= 0) continue;
        const issuer = issuers.get(issuerKey);
        if (issuer.representative_market_cap === null || marketCap > issuer.representative_market_cap) {
          issuer.symbol = symbol;
          issuer.market_cap = marketCap;
          issuer.representative_market_cap = marketCap;
        }
      }
    };

    try {
      const firstPage = (await fetchScreenerPage(0)).data || {};
      const firstRows = (firstPage.table || {}).rows || [];
      const totalRecords = Number(firstPage.totalrecords) || firstRows.length;
      collectRows(firstRows);

      const remainingOffsets = [];
      for (let offset = SCREENER_LIMIT; offset < totalRecords; offset += SCREENER_LIMIT) remainingOffsets.push(offset);

      for (let start = 0; start < remainingOffsets.length; start += 4) {
        const offsets = remainingOffsets.slice(start, start + 4);
        const pages = await Promise.all(offsets.map(fetchScreenerPage));
        for (const page of pages) collectRows(((page.data || {}).table || {}).rows);
        if ([...members.keys()].every((symbol) => foundSymbols.has(symbol))) break;
      }
    } catch (error) {
      // Fall back to constituent-only ordering when Nasdaq ranking is unavailable.
    }
  }

  const companies = includeMarketCaps
    ? [...issuers.values()].sort((a, b) => {
      const aHasCap = a.market_cap !== null;
      const bHasCap = b.market_cap !== null;
      if (aHasCap !== bHasCap) return aHasCap ? -1 : 1;
      return (b.market_cap || 0) - (a.market_cap || 0);
    })
    : [...issuers.values()];

  if (companies.length < SP500_COMPANY_COUNT) {
    throw new UpstreamError(`Only ${companies.length} distinct S&P 500 companies were found; 500 are required.`);
  }

  const trimmed = companies.slice(0, SP500_COMPANY_COUNT).map((company, index) => {
    const { representative_market_cap, ...rest } = company;
    return { ...rest, rank: includeMarketCaps ? index + 1 : null };
  });

  const expiresAt = Date.now() / 1000 + COMPANY_CACHE_SECONDS;
  if (includeMarketCaps) companyCache.withCaps = { companies: trimmed, expiresAt };
  else companyCache.noCaps = { companies: trimmed, expiresAt };
  return trimmed;
}

export async function searchSecurities(query) {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  if (trimmed.length > 60) throw new ValidationError('Search text must be 60 characters or fewer.');

  const url = new URL('https://query1.finance.yahoo.com/v1/finance/search');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('quotesCount', '12');
  url.searchParams.set('newsCount', '0');

  let payload;
  try {
    const response = await fetch(url, { headers: NASDAQ_HEADERS, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    payload = await response.json();
  } catch (error) {
    throw new UpstreamError("Could not search Yahoo Finance. Check the server's internet connection.");
  }

  const matches = [];
  const seen = new Set();
  for (const quoteResult of payload.quotes || []) {
    const symbol = String(quoteResult.symbol || '').trim().toUpperCase();
    if (quoteResult.quoteType !== 'EQUITY' || !symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    matches.push({
      symbol,
      company: quoteResult.shortname || quoteResult.longname || symbol,
      exchange: quoteResult.exchDisp || quoteResult.exchange || '',
      market_cap: quoteResult.marketCap ?? null,
      quote_type: 'EQUITY',
    });
  }
  return matches;
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-12) throw new UpstreamError('Price history is insufficient to fit a trendline.');
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    rows[column] = rows[column].map((value) => value / divisor);
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      rows[row] = rows[row].map((value, index) => value - factor * rows[column][index]);
    }
  }
  return rows.map((row) => row[row.length - 1]);
}

export function fitPolynomial(values, degree) {
  if (![1, 2].includes(degree) || values.length < degree + 1) {
    throw new UpstreamError('A linear or quadratic fit needs more observations.');
  }
  const count = values.length;
  const xs = values.map((_, index) => -1 + (2 * index) / (count - 1));
  const powers = [];
  for (let power = 0; power <= degree * 2; power += 1) {
    powers.push(xs.reduce((sum, x) => sum + x ** power, 0));
  }
  const matrix = [];
  for (let row = 0; row <= degree; row += 1) {
    matrix.push(Array.from({ length: degree + 1 }, (_, column) => powers[row + column]));
  }
  const vector = [];
  for (let power = 0; power <= degree; power += 1) {
    vector.push(xs.reduce((sum, x, index) => sum + x ** power * values[index], 0));
  }
  const coefficients = solveLinearSystem(matrix, vector);
  const predicted = xs.map((x) => coefficients.reduce((sum, coefficient, power) => sum + coefficient * x ** power, 0));
  const residualSum = values.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0);
  const mean = values.reduce((sum, value) => sum + value, 0) / count;
  const totalSum = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const rSquared = totalSum === 0 ? 1 : 1 - residualSum / totalSum;
  return { coefficients, rSquared };
}

export function buildAnalysis(payload, symbol) {
  const chart = payload.chart || {};
  if (chart.error) throw new UpstreamError(chart.error.description || 'Yahoo Finance returned a data error.');
  const results = chart.result || [];
  if (!results.length) throw new UpstreamError(`No ${symbol} price history was returned by the data provider.`);

  const result = results[0];
  const timestamps = result.timestamp || [];
  const indicators = result.indicators || {};
  const quote = (indicators.quote || [{}])[0];
  const closeValues = quote.close || [];
  const adjustedValues = (indicators.adjclose || [{}])[0].adjclose || closeValues;

  const points = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = adjustedValues[index];
    if (close === null || close === undefined || !Number.isFinite(close) || close <= 0) continue;
    points.push({
      date: new Date(timestamps[index] * 1000).toISOString().slice(0, 10),
      adjusted_close: close,
    });
  }
  if (points.length < 5) throw new UpstreamError('Not enough valid historical observations to calculate trendlines.');

  const firstPrice = points[0].adjusted_close;
  const performance = points.map((point) => (point.adjusted_close / firstPrice) * 100);
  const logPerformance = performance.map((value) => Math.log10(value));
  const linear = fitPolynomial(logPerformance, 1);
  const quadratic = fitPolynomial(logPerformance, 2);
  const recentValues = logPerformance.slice(-Math.min(RECENT_WINDOW_MONTHS, logPerformance.length));
  const recent = fitPolynomial(recentValues, 2);
  const concavity = recent.coefficients[2] >= 0 ? 'concave up' : 'concave down';

  points.forEach((point, index) => {
    const x = -1 + (2 * index) / (points.length - 1);
    point.performance = performance[index];
    const linearLogFit = linear.coefficients.reduce((sum, coefficient, power) => sum + coefficient * x ** power, 0);
    const quadraticLogFit = quadratic.coefficients.reduce((sum, coefficient, power) => sum + coefficient * x ** power, 0);
    point.linear_fit = 10 ** linearLogFit;
    point.quadratic_fit = 10 ** quadraticLogFit;
  });

  const meta = result.meta || {};
  const lastClose = (quote.close || []).filter((value) => value !== null && value !== undefined).at(-1);
  const lastPrice = meta.regularMarketPrice ?? lastClose ?? points.at(-1).adjusted_close;
  const bestFit = quadratic.rSquared >= linear.rSquared ? 'quadratic' : 'linear';

  return {
    symbol,
    currency: meta.currency || 'USD',
    source: 'Yahoo Finance chart data',
    period_start: points[0].date,
    period_end: points.at(-1).date,
    observations: points.length,
    latest_price: lastPrice,
    latest_adjusted_close: points.at(-1).adjusted_close,
    total_return_pct: (points.at(-1).adjusted_close / firstPrice - 1) * 100,
    best_fit: bestFit,
    linear_r_squared: linear.rSquared,
    quadratic_r_squared: quadratic.rSquared,
    concavity,
    concavity_window_months: recentValues.length,
    points,
    retrieved_at: new Date().toISOString(),
  };
}

export async function fetchAnalysis(symbolInput) {
  const symbol = normalizeTicker(symbolInput);
  const periodEnd = Math.floor(Date.now() / 1000);
  const url = new URL(`${HISTORY_URL}/${encodeURIComponent(symbol)}`);
  url.searchParams.set('period1', String(HISTORY_START));
  url.searchParams.set('period2', String(periodEnd));
  url.searchParams.set('interval', '1mo');
  url.searchParams.set('events', 'div,splits');

  let payload;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrendLab/1.0)', Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new UpstreamError(`Historical data provider returned HTTP ${response.status}.`);
    payload = await response.json();
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError('Could not reach Yahoo Finance. Check the server\'s internet connection.');
  }

  return buildAnalysis(payload, symbol);
}
