const SUPABASE_URL = 'https://vftmcftccahjlxbxcnsf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I8I-cRDhS60UoUgCvVvwnQ_MyKI9u14';
const NEXUS_URL = 'https://alphadyn.github.io/ai/nexus/';
const FALLBACK_IMAGE = 'https://alphadyn.github.io/ai/social-preview.png';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function itemPage(item, shareUrl) {
  const title = String(item.title || item.filename || 'Shared file').slice(0, 160);
  const description = String(item.description || item.filename || 'Shared from Nexus CMS.').slice(0, 280);
  const appUrl = new URL(NEXUS_URL);
  appUrl.searchParams.set('item', item.id);

  let imageUrl = FALLBACK_IMAGE;
  let imageType = 'image/png';
  if (String(item.mime_type || '').startsWith('image/')) {
    try {
      const candidate = new URL(item.data_url || '');
      if (candidate.protocol === 'https:'
        && candidate.hostname === new URL(SUPABASE_URL).hostname
        && candidate.pathname.startsWith('/storage/v1/object/public/nexus-media/')) {
        imageUrl = candidate.href;
        imageType = item.mime_type;
      }
    } catch {}
  }

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(imageUrl);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeAppUrl = escapeHtml(appUrl.href);
  const safeImageType = escapeHtml(imageType);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${safeShareUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Nexus CMS">
  <meta property="og:url" content="${safeShareUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:secure_url" content="${safeImage}">
  <meta property="og:image:type" content="${safeImageType}">
  <meta property="og:image:alt" content="Preview image for ${safeTitle}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">
  <title>${safeTitle} · Nexus CMS</title>
  <style>
    :root{color-scheme:dark;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0d1117;color:#f0f6fc}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#0d1117}
    main{width:min(100%,560px);overflow:hidden;border:1px solid #30363d;border-radius:14px;background:#161b22}
    img{display:block;width:100%;aspect-ratio:1.91;object-fit:cover;background:#21262d}
    section{padding:20px}
    h1{margin:0;font-size:1.35rem;overflow-wrap:anywhere}
    p{margin:8px 0 18px;color:#8b949e;overflow-wrap:anywhere}
    a{display:inline-block;padding:10px 15px;border-radius:7px;background:#2f81f7;color:white;font-weight:650;text-decoration:none}
  </style>
</head>
<body>
  <main>
    <img src="${safeImage}" alt="Preview image for ${safeTitle}">
    <section>
      <h1>${safeTitle}</h1>
      <p>${safeDescription}</p>
      <a href="${safeAppUrl}">Open in Nexus CMS</a>
    </section>
  </main>
</body>
</html>`;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).send('Method not allowed');
    return;
  }

  const requestUrl = new URL(request.url, 'https://ai-orcin-eta-15.vercel.app');
  const id = String(request.query?.id || requestUrl.searchParams.get('id') || '');
  if (!/^[\w-]{1,128}$/.test(id)) {
    response.status(400).send('Invalid item id');
    return;
  }

  try {
    const query = new URLSearchParams({
      select: 'id,title,filename,type,mime_type,description,data_url',
      id: `eq.${id}`,
      limit: '1'
    });
    const result = await fetch(`${SUPABASE_URL}/rest/v1/nexus_media_items?${query}`, {
      headers: { apikey: SUPABASE_ANON_KEY }
    });
    if (!result.ok) {
      response.status(502).send('Could not load the shared Nexus item');
      return;
    }
    const [item] = await result.json();
    if (!item) {
      response.status(404).send('Nexus item not found');
      return;
    }

    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    response.status(200).send(itemPage(item, requestUrl.href));
  } catch {
    response.status(503).send('Nexus sharing is temporarily unavailable');
  }
}