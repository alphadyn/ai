import { fetchSp500Companies, ValidationError, UpstreamError } from '../_lib/market.js';

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
    const companies = await fetchSp500Companies();
    response.status(200).json({ companies });
  } catch (error) {
    if (error instanceof ValidationError) {
      response.status(400).json({ error: error.message });
    } else if (error instanceof UpstreamError) {
      response.status(502).json({ error: error.message });
    } else {
      response.status(502).json({ error: error.message || 'Could not load S&P 500 company rankings.' });
    }
  }
}
