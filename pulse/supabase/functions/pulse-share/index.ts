const DEFAULT_APP_URL = "https://alphadyn.github.io/ai/pulse/";
const FALLBACK_IMAGE = "https://alphadyn.github.io/ai/pulse/social-preview-mobile.png";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function appBaseUrl(): string {
  const configuredUrl = Deno.env.get("APP_BASE_URL") || DEFAULT_APP_URL;
  try {
    const url = new URL(configuredUrl);
    if (url.protocol === "https:" || url.hostname === "localhost") return url.href.endsWith("/") ? url.href : `${url.href}/`;
  } catch {
    // Fall through to the repository's public deployment URL.
  }
  return DEFAULT_APP_URL;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function plainText(html: unknown): string {
  return String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
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
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#071117"><title>Post unavailable · Pulse</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#071117;color:#edf4f8;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.notice{width:min(100%,440px);padding:28px;border:1px solid #2a3b45;border-radius:20px;background:#0f181f}p{margin:8px 0;color:#a2b8c3}</style></head><body><main class="notice"><strong>◎ Pulse</strong><p>This link is unavailable or the post was removed.</p></main></body></html>`;
  return pageResponse(html, status);
}

type Attachment = { name?: string; mimeType?: string; dataUrl?: string };

function firstImageAttachment(attachments: unknown): Attachment | null {
  if (!Array.isArray(attachments)) return null;
  for (const attachment of attachments as Attachment[]) {
    const mimeType = String(attachment?.mimeType || "").toLowerCase();
    const dataUrl = String(attachment?.dataUrl || "");
    if (ALLOWED_IMAGE_TYPES.includes(mimeType) && dataUrl.startsWith(`data:${mimeType};base64,`)) return attachment;
  }
  return null;
}

function imageResponse(attachment: Attachment): Response {
  const mimeType = String(attachment.mimeType).toLowerCase();
  const base64 = String(attachment.dataUrl).slice(`data:${mimeType};base64,`.length);
  if (base64.length * 0.75 > MAX_IMAGE_BYTES) return new Response("Image too large", { status: 413 });

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);

  return new Response(bytes, {
    headers: {
      "content-type": mimeType,
      "content-length": String(bytes.length),
      "cache-control": "public, max-age=3600, s-maxage=86400",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

Deno.serve(async (request) => {
  const requestUrl = new URL(request.url);
  const postId = requestUrl.searchParams.get("post")?.trim();
  const wantsImage = requestUrl.searchParams.get("image") === "1";
  if (!postId || !/^[0-9a-f-]{36}$/i.test(postId)) return unavailablePage(404);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const apiKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !apiKey) return unavailablePage(503);

  try {
    const postsUrl = new URL("/rest/v1/posts", supabaseUrl);
    postsUrl.searchParams.set("select", "id,title,body,author_name,tags,attachments,is_deleted");
    postsUrl.searchParams.set("id", `eq.${postId}`);
    postsUrl.searchParams.set("limit", "1");
    const postsResponse = await fetch(postsUrl, { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` } });
    if (!postsResponse.ok) return unavailablePage(503);

    const [post] = await postsResponse.json();
    if (!post || post.is_deleted) return unavailablePage(404);

    const attachment = firstImageAttachment(post.attachments);
    if (wantsImage) {
      if (!attachment) return Response.redirect(FALLBACK_IMAGE, 302);
      return imageResponse(attachment);
    }

    const imageUrl = new URL(requestUrl.href);
    imageUrl.search = "";
    imageUrl.searchParams.set("post", postId);
    imageUrl.searchParams.set("image", "1");
    const previewImage = attachment ? imageUrl.href : FALLBACK_IMAGE;
    const previewImageType = attachment ? String(attachment.mimeType).toLowerCase() : "image/png";

    const appUrl = new URL(appBaseUrl());
    appUrl.searchParams.set("post", postId);

    const title = truncate(String(post.title || "Pulse post"), 140);
    const description = truncate(plainText(post.body) || `Shared by ${post.author_name || "Anonymous"} on Pulse.`, 280);
    const tags: string[] = Array.isArray(post.tags) ? post.tags.slice(0, 6).map(String) : [];

    const escapedTitle = escapeHtml(title);
    const escapedDescription = escapeHtml(description);
    const escapedImage = escapeHtml(previewImage);
    const escapedAppUrl = escapeHtml(appUrl.href);

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#071117">
  <meta name="description" content="${escapedDescription}">
  <meta name="robots" content="noindex,nofollow">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Pulse">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapeHtml(requestUrl.href)}">
  <meta property="og:image" content="${escapedImage}">
  <meta property="og:image:secure_url" content="${escapedImage}">
  <meta property="og:image:type" content="${escapeHtml(previewImageType)}">
  <meta property="og:image:alt" content="Image from the Pulse post “${escapedTitle}”">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:image" content="${escapedImage}">
  <title>${escapedTitle} · Pulse</title>
  <style>
    :root{color-scheme:dark;--bg:#071117;--panel:#0f181f;--line:#24343d;--text:#edf4f8;--muted:#a2b8c3;--accent:#8fe7ab}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;min-height:100svh;display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom));background:radial-gradient(ellipse at 80% 0%,#12323a 0,transparent 42%),var(--bg);color:var(--text);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
    .card{width:min(100%,520px);overflow:hidden;border:1px solid var(--line);border-radius:22px;background:var(--panel);box-shadow:0 30px 60px #02080d99}
    .brand{display:flex;align-items:center;gap:8px;padding:16px 20px;color:var(--accent);font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .cover{display:block;width:100%;aspect-ratio:1;object-fit:cover;background:#0d1a22}
    .body{padding:18px 20px 22px}
    h1{margin:0;font-size:clamp(22px,6vw,30px);line-height:1.18;letter-spacing:-.02em;overflow-wrap:anywhere}
    .desc{margin:10px 0 0;color:var(--muted);font-size:15px;overflow-wrap:anywhere}
    .tags{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0}
    .tag{padding:4px 9px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:12px}
    .open{display:flex;min-height:50px;align-items:center;justify-content:center;margin-top:18px;padding:12px 18px;border-radius:12px;background:var(--accent);color:#06221a;font-size:15px;font-weight:750;text-decoration:none}
    .foot{margin:12px 0 0;color:#7c909c;font-size:12px;text-align:center}
  </style>
</head>
<body>
  <main class="card">
    <div class="brand">◎ Pulse</div>
    <img class="cover" src="${escapedImage}" alt="Image from the Pulse post">
    <div class="body">
      <h1>${escapedTitle}</h1>
      <p class="desc">${escapedDescription}</p>
      ${tags.length ? `<div class="tags">${tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      <a class="open" href="${escapedAppUrl}">Open in Pulse</a>
      <p class="foot">Shared by ${escapeHtml(post.author_name || "Anonymous")}</p>
    </div>
  </main>
</body>
</html>`;
    return pageResponse(html);
  } catch {
    return unavailablePage(503);
  }
});
