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

  const requestUrl = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
  const upstreamPath = requestUrl.pathname.replace(/^\/api/, '') || '/';
  const upstreamUrl = new URL(`${NASDAQ_API}${upstreamPath}`);
  upstreamUrl.search = requestUrl.search;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Market Lens live proxy)',
        Referer: 'https://www.nasdaq.com/',
      },
      cache: 'no-store',
    });
    const body = await upstreamResponse.text();

    response.status(upstreamResponse.status);
    response.setHeader('Content-Type', upstreamResponse.headers.get('content-type') || 'application/json');
    response.send(body);
  } catch (error) {
    response.status(502).json({ error: `Nasdaq request failed: ${error.message}` });
  }
}
