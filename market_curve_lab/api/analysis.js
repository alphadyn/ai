import { fetchAnalysis, fetchSp500Companies, normalizeTicker, ValidationError, UpstreamError } from '../_lib/market.js';

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).send('Method not allowed');
    return;
  }

  try {
    const symbol = normalizeTicker(request.query.symbol || 'AAPL');
    // The client already has the S&P 500 ranking once it's loaded once, so it passes rank/market_cap
    // along to skip Nasdaq's screener here entirely; only look it up server-side when it doesn't.
    const rankParam = Number(request.query.rank);
    const marketCapParam = Number(request.query.market_cap);
    const hasClientRank = Number.isFinite(rankParam) && rankParam > 0;

    const [result, companies] = await Promise.all([
      fetchAnalysis(symbol),
      hasClientRank ? Promise.resolve([]) : fetchSp500Companies().catch(() => []),
    ]);
    const company = hasClientRank ? null : companies.find((item) => item.symbol === symbol) || null;
    result.company = company ? company.company : request.query.company || symbol;
    result.exchange = request.query.exchange || '';
    result.market_cap = hasClientRank ? (Number.isFinite(marketCapParam) ? marketCapParam : null) : (company ? company.market_cap : null);
    result.market_cap_rank = hasClientRank ? rankParam : (company ? company.rank : null);
    response.status(200).json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      response.status(400).json({ error: error.message });
    } else if (error instanceof UpstreamError) {
      response.status(502).json({ error: error.message });
    } else {
      response.status(502).json({ error: error.message || 'Could not load the requested stock history.' });
    }
  }
}
