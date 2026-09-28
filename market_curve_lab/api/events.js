import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

const ALLOWED_ORIGINS = new Set([
  'https://alphadyn.github.io',
  'http://127.0.0.1:8765',
  'http://localhost:8765'
]);
const MAX_BODY_BYTES = 4096;
const MAX_RECORDS = 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 60;
const ingestRateWindows = new Map();

function setCors(request, response) {
  const origin = request.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Cache-Control', 'no-store');
}

function getIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  const candidate = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
  return isIP(candidate) ? candidate : 'Not recorded';
}

function isRateLimited(request) {
  const key = getIp(request);
  const now = Date.now();
  let window = ingestRateWindows.get(key);
  if (!window || now - window.startedAt >= RATE_WINDOW_MS) {
    window = { startedAt: now, count: 0 };
    ingestRateWindows.set(key, window);
  }
  if (window.count >= RATE_LIMIT_PER_WINDOW) return true;
  window.count += 1;
  if (ingestRateWindows.size > 2000) {
    for (const [address, entry] of ingestRateWindows) {
      if (now - entry.startedAt >= RATE_WINDOW_MS) ingestRateWindows.delete(address);
    }
  }
  return false;
}

function parseBody(request) {
  if (typeof request.body === 'string') {
    if (Buffer.byteLength(request.body, 'utf8') > MAX_BODY_BYTES) throw new Error('Event payload is too large');
    return JSON.parse(request.body);
  }
  const body = request.body || {};
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) throw new Error('Event payload is too large');
  return body;
}

function configured(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function authorized(request) {
  const token = process.env.ANALYTICS_READ_TOKEN;
  const header = request.headers.authorization || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || token.length < 32 || !supplied) return false;
  const expectedBuffer = Buffer.from(token);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function supabaseRequest(path, init = {}) {
  const baseUrl = configured('SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = configured('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      ...init.headers
    }
  });
}

function validEvent(body) {
  return body && typeof body === 'object'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.visitorId || '')
    && typeof body.path === 'string' && body.path.startsWith('/') && body.path.length <= 500
    && typeof body.page === 'string' && body.page.length > 0 && body.page.length <= 160
    && typeof body.referrer === 'string' && body.referrer.length <= 255
    && (body.referrerUrl === null || typeof body.referrerUrl === 'string' && body.referrerUrl.length <= 500)
    && ['Desktop', 'Mobile', 'Tablet'].includes(body.device);
}

export default async function handler(request, response) {
  setCors(request, response);
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method === 'POST') {
    if (!ALLOWED_ORIGINS.has(request.headers.origin)) {
      response.status(403).json({ error: 'Origin not allowed' });
      return;
    }
    if (isRateLimited(request)) {
      response.status(429).json({ error: 'Page-view rate limit exceeded' });
      return;
    }
    try {
      const body = parseBody(request);
      if (!validEvent(body)) {
        response.status(400).json({ error: 'Invalid page-view event' });
        return;
      }
      const row = {
        visitor_id: body.visitorId,
        timestamp: new Date().toISOString(),
        ip: getIp(request),
        path: body.path,
        page: body.page,
        referrer: body.referrer,
        referrer_url: body.referrerUrl,
        device: body.device,
        status: null,
        session_seconds: null,
        bounced: null
      };
      const result = await supabaseRequest('traffic_events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row)
      });
      if (!result.ok) {
        response.status(502).json({ error: 'Could not store the page view' });
        return;
      }
      response.status(202).json({ accepted: true });
    } catch (error) {
      const tooLarge = error.message === 'Event payload is too large';
      response.status(tooLarge ? 413 : 503).json({ error: tooLarge ? error.message : 'Analytics storage is unavailable' });
    }
    return;
  }

  if (request.method === 'GET') {
    if (!ALLOWED_ORIGINS.has(request.headers.origin)) {
      response.status(403).json({ error: 'Origin not allowed' });
      return;
    }
    if (!authorized(request)) {
      response.status(401).json({ error: 'Analytics access is unauthorized' });
      return;
    }
    try {
      const result = await supabaseRequest(`traffic_events?select=id,visitor_id,timestamp,ip,path,page,referrer,referrer_url,device,status,session_seconds,bounced&order=timestamp.desc&limit=${MAX_RECORDS}`);
      if (!result.ok) {
        response.status(502).json({ error: 'Could not load traffic events' });
        return;
      }
      const rows = await result.json();
      response.status(200).json({ events: rows.map((row) => ({
        id: row.id,
        visitorId: row.visitor_id,
        timestamp: row.timestamp,
        ip: row.ip,
        path: row.path,
        page: row.page,
        referrer: row.referrer,
        referrerUrl: row.referrer_url,
        location: 'Not recorded',
        device: row.device,
        status: row.status,
        sessionSeconds: row.session_seconds,
        bounced: row.bounced
      })) });
    } catch (error) {
      response.status(503).json({ error: 'Analytics storage is unavailable' });
    }
    return;
  }

  response.setHeader('Allow', 'GET, POST, OPTIONS');
  response.status(405).json({ error: 'Method not allowed' });
}
