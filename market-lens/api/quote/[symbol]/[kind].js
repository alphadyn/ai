const NASDAQ_API = 'https://api.nasdaq.com/api';

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

  const { symbol, kind } = request.query;
  const upstreamUrl = new URL(`${NASDAQ_API}/quote/${symbol}/${kind}`);
  for (const [key, value] of Object.entries(request.query)) {
    if (key !== 'symbol' && key !== 'kind') upstreamUrl.searchParams.set(key, value);
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Market Lens live proxy)',
        Referer: 'https://www.nasdaq.com/',
      },
      cache: 'no-store',
    });
    response.status(upstreamResponse.status);
    response.setHeader('Content-Type', upstreamResponse.headers.get('content-type') || 'application/json');
    response.send(await upstreamResponse.text());
  } catch (error) {
    response.status(502).json({ error: `Nasdaq request failed: ${error.message}` });
  }
}
