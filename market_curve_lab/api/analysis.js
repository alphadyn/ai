import { fetchAnalysis, fetchSp500Companies, normalizeTicker, ValidationError, UpstreamError } from '../_lib/market.js';

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Cache-Control', 'no-store, max-age=0');

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
    let companies = [];
    try {
      companies = await fetchSp500Companies();
    } catch (error) {
      companies = [];
    }
    const company = companies.find((item) => item.symbol === symbol) || null;
    const result = await fetchAnalysis(symbol);
    result.company = company ? company.company : request.query.company || symbol;
    result.exchange = request.query.exchange || '';
    result.market_cap = company ? company.market_cap : null;
    result.market_cap_rank = company ? company.rank : null;
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
