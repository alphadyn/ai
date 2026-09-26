const DEFAULT_APP_URL = "https://alphadyn.github.io/ai/experiences_app/";
const FALLBACK_IMAGE = "https://alphadyn.github.io/ai/experiences_app/assets/experience-pin-photos.png";
const MAX_PREVIEW_EVENTS = 40;

function appBaseUrl(): string {
  const configuredUrl = Deno.env.get("APP_BASE_URL") || DEFAULT_APP_URL;
  try {
    const url = new URL(configuredUrl);
    if (url.protocol === "https:" || url.hostname === "localhost") return url.href.endsWith("/") ? url.href : `${url.href}/`;
  } catch {
    // Use the repository's public deployment URL when the override is invalid.
  }
  return DEFAULT_APP_URL;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function safeImageUrl(value: unknown): string {
  try {
    const imageUrl = new URL(String(value));
    return imageUrl.protocol === "https:" ? imageUrl.href : FALLBACK_IMAGE;
  } catch {
    return FALLBACK_IMAGE;
  }
}

function pageResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=120, s-maxage=300",
      "content-security-policy": "default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function unavailablePage(status: number): Response {
  const title = "Experience unavailable · Experiences";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#f3f6f1"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f3f6f1;color:#17212b;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.notice{width:min(100%,440px);padding:28px;border:1px solid #d8e1dc;border-radius:20px;background:#fffdf8;box-shadow:0 18px 48px #1f34251a}p{margin:8px 0;color:#68756f}</style></head><body><main class="notice"><strong>Experiences</strong><p>This link is unavailable or the Experience is no longer public.</p></main></body></html>`;
  return pageResponse(html, status);
}

Deno.serve(async (request) => {
  const requestUrl = new URL(request.url);
  const slug = requestUrl.searchParams.get("slug")?.trim();
  if (!slug || slug.length > 180) return unavailablePage(404);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const apiKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !apiKey) return unavailablePage(503);

  const restUrl = new URL("/rest/v1/", supabaseUrl);
  const apiRequest = (path: string, query: Record<string, string>, headers: Record<string, string> = {}) => {
    const url = new URL(path, restUrl);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    return fetch(url, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        ...headers,
      },
    });
  };

  try {
    const experiencesResponse = await apiRequest("checkin_map_experiences", {
      select: "id,name,description,public_slug,is_public",
      public_slug: `eq.${slug}`,
      is_public: "eq.true",
      limit: "1",
    });
    if (!experiencesResponse.ok) return unavailablePage(503);
    const [experience] = await experiencesResponse.json();
    if (!experience) return unavailablePage(404);

    const locationsResponse = await apiRequest("checkin_map_locations", {
      select: "id",
      experience_id: `eq.${experience.id}`,
      order: "timestamp.asc",
      limit: String(MAX_PREVIEW_EVENTS),
    }, { Prefer: "count=exact" });
    const locations = locationsResponse.ok ? await locationsResponse.json() : [];
    const contentRange = locationsResponse.headers.get("content-range") || "";
    const eventCount = Number(contentRange.split("/").at(-1)) || locations.length;

    let imageUrl = FALLBACK_IMAGE;
    let imageType = "image/png";
    if (locations.length) {
      const ids = `(${locations.map((location: { id: string }) => `"${location.id}"`).join(",")})`;
      const mediaResponse = await apiRequest("checkin_map_media", {
        select: "public_url,mime_type,created_at",
        checkin_id: `in.${ids}`,
        order: "created_at.asc",
        limit: "60",
      });
      if (mediaResponse.ok) {
        const media = await mediaResponse.json();
        const cover = media.find((item: { mime_type?: string; public_url?: string }) => /^image\/(jpeg|png|webp)$/i.test(item.mime_type || "") && item.public_url);
        if (cover) {
          imageUrl = safeImageUrl(cover.public_url);
          imageType = cover.mime_type;
        }
      }
    }

    const baseUrl = appBaseUrl();
    const appUrl = new URL(baseUrl);
    appUrl.searchParams.set("experience", experience.public_slug);
    const title = `${experience.name} · Experiences`;
    const description = String(experience.description || `${eventCount} ${eventCount === 1 ? "moment" : "moments"} mapped. Explore the places and story in Experiences.`).trim().slice(0, 280);
    const escapedTitle = escapeHtml(title);
    const escapedDescription = escapeHtml(description);
    const escapedImage = escapeHtml(imageUrl);
    const twitterImage = imageType === "image/webp" ? FALLBACK_IMAGE : imageUrl;
    const escapedTwitterImage = escapeHtml(twitterImage);
    const escapedAppUrl = escapeHtml(appUrl.href);
    const eventSummary = eventCount ? `${eventCount} ${eventCount === 1 ? "moment" : "moments"} on the map` : "A personal map of places and memories";
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#f3f6f1">
  <meta name="description" content="${escapedDescription}">
  <meta name="robots" content="noindex,nofollow">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Experiences">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapeHtml(requestUrl.href)}">
  <meta property="og:image" content="${escapedImage}">
  <meta property="og:image:secure_url" content="${escapedImage}">
  <meta property="og:image:type" content="${escapeHtml(imageType)}">
  <meta property="og:image:alt" content="Photos attached to the places in ${escapeHtml(experience.name)}">
  <meta property="og:image" content="${FALLBACK_IMAGE}">
  <meta property="og:image:secure_url" content="${FALLBACK_IMAGE}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1080">
  <meta property="og:image:height" content="1080">
  <meta property="og:image:alt" content="Tourist photos linked to map pins in ${escapeHtml(experience.name)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:image" content="${escapedTwitterImage}">
  <meta name="twitter:image:alt" content="A photo from ${escapeHtml(experience.name)}">
  <title>${escapedTitle}</title>
  <style>
    :root{color-scheme:light;--ink:#17212b;--muted:#68756f;--accent:#0f766e;--border:#d8e1dc;--paper:#fffdf8;--wash:#f3f6f1}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;min-height:100svh;padding:max(20px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom));display:grid;place-items:center;background:radial-gradient(ellipse at 90% 0%,#dff4ef 0,transparent 36%),var(--wash);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
    .preview{width:min(100%,520px);overflow:hidden;border:1px solid var(--border);border-radius:22px;background:var(--paper);box-shadow:0 24px 64px #1f34251c}
    .brand{display:flex;align-items:center;gap:10px;padding:18px 20px;color:var(--accent);font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .brand img{width:28px;height:28px;border-radius:8px}
    .cover{display:block;width:100%;aspect-ratio:1.91;object-fit:cover;background:#eaf1ed}
    .body{padding:20px 22px 22px}
    .eyebrow{margin:0 0 6px;color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
    h1{margin:0;font-family:Georgia,"Times New Roman",serif;font-size:clamp(27px,7vw,36px);line-height:1.12;letter-spacing:-.035em;overflow-wrap:anywhere}
    .description{margin:10px 0 0;color:var(--muted);font-size:15px;line-height:1.55;overflow-wrap:anywhere}
    .count{display:flex;align-items:center;gap:8px;margin:18px 0;color:#48615a;font-size:13px;font-weight:700}
    .dot{width:8px;height:8px;border-radius:50%;background:#c85c45;box-shadow:0 0 0 4px #c85c451f}
    .open{display:flex;min-height:50px;align-items:center;justify-content:center;padding:12px 18px;border-radius:12px;background:var(--accent);color:white;font-size:15px;font-weight:750;text-decoration:none;box-shadow:0 7px 16px #0f766e2e}
    .open:focus-visible{outline:3px solid #0f766e55;outline-offset:3px}
    .foot{margin:14px 0 0;color:#86928d;font-size:12px;text-align:center}
    @media(max-width:380px){body{padding-left:12px;padding-right:12px}.brand{padding:15px 16px}.body{padding:17px 17px 19px}.preview{border-radius:18px}}
  </style>
</head>
<body>
  <main class="preview">
    <div class="brand"><img src="${escapeHtml(new URL("assets/experiences-favicon.svg", DEFAULT_APP_URL).href)}" alt=""><span>Experiences · Location Journal</span></div>
    <img class="cover" src="${escapedImage}" alt="A photo from ${escapeHtml(experience.name)}">
    <div class="body">
      <p class="eyebrow">A shared Experience</p>
      <h1>${escapeHtml(experience.name)}</h1>
      <p class="description">${escapedDescription}</p>
      <p class="count"><span class="dot" aria-hidden="true"></span>${escapeHtml(eventSummary)}</p>
      <a class="open" href="${escapedAppUrl}">Open this Experience</a>
      <p class="foot">A living map for the places, moments, and stories that make a trip yours.</p>
    </div>
  </main>
</body>
</html>`;
    return pageResponse(html);
  } catch {
    return unavailablePage(503);
  }
});
