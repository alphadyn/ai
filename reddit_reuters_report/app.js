const POST_LIMIT = 100;
// Same-origin endpoint served by server.py, which fetches Reddit server-side
// so the browser never has to make a cross-origin request (which Reddit blocks).
const FEED_URL = "/api/reddit-front-page";
const FETCH_TIMEOUT_MS = 8000;

const statusEl = document.getElementById("status");
const heroSection = document.getElementById("heroSection");
const gridSection = document.getElementById("gridSection");
const listSection = document.getElementById("listSection");
const topnav = document.getElementById("topnav");
const editionDate = document.getElementById("editionDate");

function setEditionDate() {
  editionDate.textContent = new Date().toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(createdUtcSeconds) {
  const seconds = Math.max(0, Date.now() / 1000 - createdUtcSeconds);
  const units = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [label, secondsPerUnit] of units) {
    const value = Math.floor(seconds / secondsPerUnit);
    if (value >= 1) {
      return `${value} ${label}${value === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

function bestImageUrl(post) {
  const previewSource = post.preview?.images?.[0]?.source?.url;
  if (previewSource) return previewSource;
  if (post.thumbnail && post.thumbnail.startsWith("http")) return post.thumbnail;
  return null;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function articleMeta(post) {
  return `r/${escapeHtml(post.subreddit)} &middot; u/${escapeHtml(post.author)} &middot; ${timeAgo(post.created_utc)} &middot; ${post.num_comments.toLocaleString()} comments`;
}

function renderHero(mainPost, sidePosts) {
  const image = bestImageUrl(mainPost);
  const mediaHtml = image
    ? `<img class="hero-media" src="${escapeHtml(image)}" alt="" loading="lazy" />`
    : `<div class="hero-media"></div>`;

  const sideHtml = sidePosts
    .map(
      (post) => `
        <div class="hero-side-item">
          <p class="meta">${articleMeta(post)}</p>
          <h4><a href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.title)}</a></h4>
        </div>`
    )
    .join("");

  heroSection.innerHTML = `
    <div class="hero-main">
      <a href="${escapeHtml(mainPost.url)}" target="_blank" rel="noopener noreferrer">${mediaHtml}</a>
      <div class="hero-body">
        <p class="meta">${articleMeta(mainPost)}</p>
        <h3><a href="${escapeHtml(mainPost.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(mainPost.title)}</a></h3>
      </div>
    </div>
    <div class="hero-side">${sideHtml}</div>
  `;
  heroSection.hidden = false;
}

function renderGrid(posts) {
  gridSection.innerHTML = posts
    .map((post) => {
      const image = bestImageUrl(post);
      const imgHtml = image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" />` : `<img alt="" />`;
      return `
        <article class="story-card">
          <a href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer">${imgHtml}</a>
          <p class="meta">${articleMeta(post)}</p>
          <h3><a href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.title)}</a></h3>
        </article>`;
    })
    .join("");
}

function renderList(posts) {
  listSection.innerHTML = posts
    .map(
      (post) => `
        <div class="headline-row">
          <h4><a href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.title)}</a></h4>
          <span class="headline-meta">r/${escapeHtml(post.subreddit)} &middot; ${timeAgo(post.created_utc)}</span>
        </div>`
    )
    .join("");
}

function renderTopnav(posts) {
  const subreddits = [...new Set(posts.map((post) => post.subreddit))].slice(0, 10);
  topnav.innerHTML = subreddits.map((name) => `<span>r/${escapeHtml(name)}</span>`).join("");
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFrontPagePosts() {
  // Cache-busting query param forces a fresh fetch on every page load.
  const response = await fetchWithTimeout(`${FEED_URL}?_=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`server responded with status ${response.status}`);
  }
  const payload = await response.json();
  const posts = payload.data.children
    .map((child) => child.data)
    .filter((post) => !post.stickied)
    .slice(0, POST_LIMIT);
  if (posts.length === 0) {
    throw new Error("no posts were returned");
  }
  return posts;
}

async function loadFrontPage() {
  setEditionDate();
  statusEl.textContent = "Fetching the latest stories…";
  statusEl.classList.remove("error");

  try {
    const posts = await fetchFrontPagePosts();

    renderTopnav(posts);
    renderHero(posts[0], posts.slice(1, 5));
    renderGrid(posts.slice(5, 14));
    renderList(posts.slice(14));

    statusEl.textContent = `Showing ${posts.length} stories from Reddit's front page, updated ${new Date().toLocaleTimeString()}.`;
  } catch (error) {
    statusEl.textContent = `Could not load Reddit's front page: ${error.message}. Make sure you started this app with "python3 server.py" and refresh to retry.`;
    statusEl.classList.add("error");
  }
}

loadFrontPage();
