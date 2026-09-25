import { searchSecurities, ValidationError, UpstreamError } from '../_lib/market.js';

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
    const query = Array.isArray(request.query.q) ? request.query.q[0] : request.query.q || '';
    const results = await searchSecurities(query);
    response.status(200).json({ results });
  } catch (error) {
    if (error instanceof ValidationError) {
      response.status(400).json({ error: error.message });
    } else if (error instanceof UpstreamError) {
      response.status(502).json({ error: error.message });
    } else {
      response.status(502).json({ error: error.message || 'Stock search is unavailable.' });
    }
  }
}
