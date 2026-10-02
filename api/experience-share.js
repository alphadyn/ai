const SUPABASE_URL = 'https://vftmcftccahjlxbxcnsf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I8I-cRDhS60UoUgCvVvwnQ_MyKI9u14';
const APP_URL = 'https://alphadyn.github.io/ai/experiences/';
const FALLBACK_IMAGE = 'https://alphadyn.github.io/ai/experiences/assets/experience-pin-photos.png';
const MAX_PREVIEW_EVENTS = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] ?? character);
}

function safeImageUrl(value) {
  try {
    const imageUrl = new URL(String(value));
    if (imageUrl.protocol === 'https:'
      && imageUrl.hostname === new URL(SUPABASE_URL).hostname
      && imageUrl.pathname.startsWith('/storage/v1/object/public/checkin-map-media/')) {
      return imageUrl.href;
    }
  } catch {}
  return FALLBACK_IMAGE;
}

function pageResponse(response, html, status = 200) {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  response.setHeader('Content-Security-Policy', "default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.status(status).send(html);
}

function unavailablePage(response, status) {
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Experience unavailable</title></head><body><main><h1>Experience unavailable</h1><p>This link is unavailable or the Experience is no longer public.</p></main></body></html>';
  pageResponse(response, html, status);
}

function previewPage(experience, shareUrl, eventCount, imageUrl, imageType) {
  const appUrl = new URL(APP_URL);
  appUrl.searchParams.set('experience', experience.public_slug);
  const title = `${experience.name} · Experiences`;
  const description = String(experience.description || `${eventCount} ${eventCount === 1 ? 'moment' : 'moments'} mapped. Explore the places and story in Experiences.`).trim().slice(0, 280);
  const eventSummary = eventCount ? `${eventCount} ${eventCount === 1 ? 'moment' : 'moments'} on the map` : 'A personal map of places and memories';
  const twitterImage = imageType === 'image/webp' ? FALLBACK_IMAGE : imageUrl;
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(imageUrl);
  const safeImageType = escapeHtml(imageType);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeAppUrl = escapeHtml(appUrl.href);
  const safeExperienceName = escapeHtml(experience.name);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#f3f6f1">
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${safeShareUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Experiences">
  <meta property="og:url" content="${safeShareUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:secure_url" content="${safeImage}">
  <meta property="og:image:type" content="${safeImageType}">
  <meta property="og:image:alt" content="Photos attached to the places in ${safeExperienceName}">
  <meta property="og:image" content="${FALLBACK_IMAGE}">
  <meta property="og:image:secure_url" content="${FALLBACK_IMAGE}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1080">
  <meta property="og:image:height" content="1080">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${escapeHtml(twitterImage)}">
  <title>${safeTitle}</title>
  <style>
    :root{color-scheme:light;--ink:#17212b;--muted:#68756f;--accent:#0f766e;--border:#d8e1dc;--paper:#fffdf8;--wash:#f3f6f1}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;min-height:100svh;padding:24px 16px;display:grid;place-items:center;background:radial-gradient(ellipse at 90% 0%,#dff4ef 0,transparent 36%),var(--wash);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(100%,520px);overflow:hidden;border:1px solid var(--border);border-radius:18px;background:var(--paper);box-shadow:0 24px 64px #1f34251c}
    .brand{padding:18px 20px;color:var(--accent);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
    .cover{display:block;width:100%;aspect-ratio:1.91;object-fit:cover;background:#eaf1ed}
    section{padding:20px 22px 22px}
    h1{margin:0;font-family:Georgia,"Times New Roman",serif;font-size:32px;line-height:1.12;overflow-wrap:anywhere}
    p{margin:10px 0;color:var(--muted);overflow-wrap:anywhere}
    .count{margin:18px 0;color:#48615a;font-size:13px;font-weight:700}
    a{display:flex;min-height:50px;align-items:center;justify-content:center;padding:12px 18px;border-radius:10px;background:var(--accent);color:white;font-weight:750;text-decoration:none}
  </style>
</head>
<body>
  <main>
    <div class="brand">Experiences · Location Journal</div>
    <img class="cover" src="${safeImage}" alt="A photo from ${safeExperienceName}">
    <section>
      <h1>${safeExperienceName}</h1>
      <p>${safeDescription}</p>
      <p class="count">${escapeHtml(eventSummary)}</p>
      <a href="${safeAppUrl}">Open this Experience</a>
    </section>
  </main>
</body>
</html>`;
}

async function supabaseRequest(table, query, headers = {}) {
  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  return fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...headers
    }
  });
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).send('Method not allowed');
    return;
  }

  const requestUrl = new URL(request.url, `https://${request.headers.host || 'ai-orcin-eta-15.vercel.app'}`);
  const identifier = String(request.query?.experience || requestUrl.searchParams.get('experience') || '').trim();
  if (!identifier || identifier.length > 180) {
    unavailablePage(response, 404);
    return;
  }

  try {
    const experienceQuery = {
      select: 'id,name,description,public_slug,is_public',
      is_public: 'eq.true',
      limit: '1'
    };
    if (UUID.test(identifier)) experienceQuery.or = `(id.eq.${identifier},public_slug.eq.${identifier})`;
    else experienceQuery.public_slug = `eq.${identifier}`;

    const experienceResponse = await supabaseRequest('checkin_map_experiences', experienceQuery);
    if (!experienceResponse.ok) {
      unavailablePage(response, 503);
      return;
    }
    const [experience] = await experienceResponse.json();
    if (!experience) {
      unavailablePage(response, 404);
      return;
    }

    const locationsResponse = await supabaseRequest('checkin_map_locations', {
      select: 'id',
      experience_id: `eq.${experience.id}`,
      order: 'timestamp.asc',
      limit: String(MAX_PREVIEW_EVENTS)
    }, { Prefer: 'count=exact' });
    const locations = locationsResponse.ok ? await locationsResponse.json() : [];
    const contentRange = locationsResponse.headers.get('content-range') || '';
    const eventCount = Number(contentRange.split('/').at(-1)) || locations.length;

    let imageUrl = FALLBACK_IMAGE;
    let imageType = 'image/png';
    if (locations.length) {
      const mediaResponse = await supabaseRequest('checkin_map_media', {
        select: 'public_url,mime_type,created_at',
        checkin_id: `in.(${locations.map((location) => location.id).join(',')})`,
        order: 'created_at.asc',
        limit: '60'
      });
      if (mediaResponse.ok) {
        const media = await mediaResponse.json();
        const cover = media.find((item) => /^image\/(jpeg|png|webp)$/i.test(item.mime_type || '') && item.public_url);
        if (cover) {
          imageUrl = safeImageUrl(cover.public_url);
          imageType = cover.mime_type.toLowerCase();
        }
      }
    }

    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    response.setHeader('Content-Security-Policy', "default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.status(200).send(previewPage(experience, requestUrl.href, eventCount, imageUrl, imageType));
  } catch {
    unavailablePage(response, 503);
  }
}