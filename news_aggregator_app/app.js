'use strict';

/* Pulse — social news aggregator frontend (vanilla JS, no build step). */

/* Pulse talks directly to Supabase (PostgREST + Auth) over HTTPS — there is
 * no custom backend. Row Level Security in supabase-schema.sql enforces who
 * can read/write what; this module just wraps the raw REST/Auth calls. */
const CONFIG = window.PULSE_SUPABASE || {};
const EMAIL_DOMAIN = 'pulse.local';
const SESSION_KEY = 'pulse_session';

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; }
}

function saveSession(data) {
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user_id: (data.user && data.user.id) || null,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function getAccessToken() {
  const session = getSession();
  if (!session) return null;
  if (session.expires_at - 30000 > Date.now()) return session.access_token;
  if (!session.refresh_token) { clearSession(); return null; }
  try {
    const res = await fetch(`${CONFIG.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: CONFIG.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) { clearSession(); return null; }
    const data = await res.json();
    return saveSession(data).access_token;
  } catch (_) {
    clearSession();
    return null;
  }
}

async function currentVoterKey() {
  const session = getSession();
  if (session && session.user_id) {
    const token = await getAccessToken();
    if (token) return `user:${session.user_id}`;
  }
  return `anon:${anonId()}`;
}

function parseResponseBody(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return text; }
}

async function authFetch(path, body) {
  const res = await fetch(`${CONFIG.url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: CONFIG.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = parseResponseBody(await res.text());
  if (!res.ok) {
    const message = (data && (data.msg || data.error_description || data.message)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

async function restFetch(method, table, { params, body, prefer, headers } = {}) {
  const token = await getAccessToken();
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  const res = await fetch(`${CONFIG.url}/rest/v1/${table}${qs}`, {
    method,
    headers: {
      apikey: CONFIG.anonKey,
      Authorization: `Bearer ${token || CONFIG.anonKey}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = parseResponseBody(await res.text());
  if (!res.ok) {
    const message = (data && (data.message || data.error_description)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return { data, headers: res.headers };
}

async function rpcFetch(name, args) {
  const token = await getAccessToken();
  const res = await fetch(`${CONFIG.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: CONFIG.anonKey,
      Authorization: `Bearer ${token || CONFIG.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args || {}),
  });
  const data = parseResponseBody(await res.text());
  if (!res.ok) {
    const message = (data && (data.message || data.error_description)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function anonId() {
  let id = localStorage.getItem('pulse_anon_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `anon-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('pulse_anon_id', id);
  }
  return id;
}

/* ---- Whitelist HTML sanitizer (mirrors the server-side one from before   */
/* the static rewrite) — applied at both submit time and read time, since   */
/* a client bypassing our JS could otherwise POST raw HTML directly.        */
const ALLOWED_RICH_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'a', 'p', 'br', 'ul', 'ol', 'li',
  'blockquote', 'code', 'pre', 'h3', 'h4', 'span']);

function sanitizeRichText(raw) {
  if (!raw) return '';
  let text = raw.replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');
  text = text.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');
  text = text.replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '');
  text = text.replace(/<\/?([a-zA-Z0-9]+)[^>]*>/g, (match, tag) => (ALLOWED_RICH_TAGS.has(tag.toLowerCase()) ? match : ''));
  return text;
}

function plainExcerpt(html, limit = 5000) {
  const text = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, limit);
}

function hotScore(upvotes, downvotes, createdAt) {
  const score = upvotes - downvotes;
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : (score < 0 ? -1 : 0);
  const epochSeconds = new Date(createdAt).getTime() / 1000;
  return sign * order + (epochSeconds - 1_600_000_000) / 45000;
}

function toUser(profile) {
  return { id: profile.id, username: profile.username, role: profile.role, avatar: profile.avatar_data_url };
}

async function fetchProfile(userId) {
  const { data } = await restFetch('GET', 'profiles', { params: { id: `eq.${userId}`, select: '*' } });
  return (data && data[0]) || null;
}

async function fetchAvatars(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await restFetch('GET', 'profiles', { params: { id: `in.(${unique.join(',')})`, select: 'id,avatar_data_url' } });
  const map = {};
  (data || []).forEach((p) => { map[p.id] = p.avatar_data_url; });
  return map;
}

function mapPostRow(row, commentCount = 0, myVote = 0, authorAvatar = null) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar,
    title: row.title,
    body: sanitizeRichText(row.body || ''),
    linkUrl: row.link_url,
    tags: row.tags || [],
    attachments: row.attachments || [],
    score: row.upvotes - row.downvotes,
    hotRank: hotScore(row.upvotes, row.downvotes, row.created_at),
    commentCount,
    myVote,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
  };
}

function mapCommentRow(row, authorAvatar = null) {
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar,
    body: sanitizeRichText(row.body || ''),
    attachments: row.attachments || [],
    score: row.upvotes - row.downvotes,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    replies: [],
  };
}

async function buildCommentTree(rows) {
  const avatars = await fetchAvatars(rows.map((r) => r.author_id));
  const byId = {};
  const roots = [];
  for (const row of rows) {
    const item = mapCommentRow(row, avatars[row.author_id]);
    if (item.isDeleted) { item.body = ''; item.authorName = '[deleted]'; item.authorAvatar = null; item.attachments = []; }
    byId[item.id] = item;
  }
  for (const item of Object.values(byId)) {
    if (item.parentId && byId[item.parentId]) byId[item.parentId].replies.push(item);
    else roots.push(item);
  }
  return roots;
}

const pulse = {
  async register(username, password) {
    username = username.trim();
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) throw new Error('Username must be 3-32 characters (letters, numbers, _ . -).');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    const data = await authFetch('signup', { email: usernameToEmail(username), password, data: { username } });
    if (!data.access_token) {
      throw new Error('Sign-up succeeded but no session was returned. Ask the site owner to disable "Confirm email" in Supabase Auth settings (see README).');
    }
    saveSession(data);
    const profile = await fetchProfile(data.user.id);
    return toUser(profile);
  },

  async login(username, password) {
    const data = await authFetch('token?grant_type=password', { email: usernameToEmail(username), password });
    saveSession(data);
    const profile = await fetchProfile(data.user.id);
    return toUser(profile);
  },

  async logout() {
    const session = getSession();
    if (session && session.access_token) {
      try {
        await fetch(`${CONFIG.url}/auth/v1/logout`, {
          method: 'POST',
          headers: { apikey: CONFIG.anonKey, Authorization: `Bearer ${session.access_token}` },
        });
      } catch (_) { /* best effort */ }
    }
    clearSession();
  },

  async me() {
    const session = getSession();
    if (!session || !session.user_id) return null;
    const token = await getAccessToken();
    if (!token) return null;
    const profile = await fetchProfile(session.user_id);
    return profile ? toUser(profile) : null;
  },

  async setAvatar(avatarDataUrl) {
    const session = getSession();
    if (!session || !session.user_id) throw new Error('Log in to set a profile picture.');
    if (avatarDataUrl) {
      if (!/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/.test(avatarDataUrl)) {
        throw new Error('Avatar must be a PNG, JPEG, GIF, WEBP, or SVG image.');
      }
      if ((avatarDataUrl.length * 3) / 4 > 256 * 1024) throw new Error('Avatar image must be smaller than 256KB.');
    }
    await restFetch('PATCH', 'profiles', {
      params: { id: `eq.${session.user_id}` },
      body: { avatar_data_url: avatarDataUrl },
      prefer: 'return=minimal',
    });
  },

  async listTags() {
    const { data } = await restFetch('GET', 'posts', { params: { is_deleted: 'eq.false', select: 'tags' } });
    const counts = {};
    (data || []).forEach((row) => { (row.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }); });
    return Object.entries(counts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  },

  async listPosts({ sort = 'hot', tag = null, query = null, limit = 30, offset = 0 } = {}) {
    const { data: rows } = await restFetch('GET', 'posts', { params: { select: '*' } });
    const posts = rows || [];
    const { data: commentRows } = await restFetch('GET', 'comments', { params: { is_deleted: 'eq.false', select: 'post_id' } });
    const counts = {};
    (commentRows || []).forEach((c) => { counts[c.post_id] = (counts[c.post_id] || 0) + 1; });

    const voterKey = await currentVoterKey();
    const { data: voteRows } = await restFetch('GET', 'post_votes', { params: { voter_key: `eq.${voterKey}`, select: 'post_id,value' } });
    const myVotes = {};
    (voteRows || []).forEach((v) => { myVotes[v.post_id] = v.value; });

    const avatars = await fetchAvatars(posts.map((p) => p.author_id));
    let items = posts.map((row) => mapPostRow(row, counts[row.id] || 0, myVotes[row.id] || 0, avatars[row.author_id]));

    if (tag) {
      const t = tag.trim().toLowerCase();
      items = items.filter((p) => p.tags.includes(t));
    }
    if (query) {
      const q = query.trim().toLowerCase();
      items = items.filter((p) => p.title.toLowerCase().includes(q)
        || plainExcerpt(p.body).toLowerCase().includes(q)
        || p.tags.some((t) => t.includes(q)));
    }

    if (sort === 'new') items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    else if (sort === 'top') items.sort((a, b) => (b.score - a.score) || (a.createdAt < b.createdAt ? 1 : -1));
    else items.sort((a, b) => b.hotRank - a.hotRank);

    return items.slice(offset, offset + limit);
  },

  async getPost(id) {
    const { data: rows } = await restFetch('GET', 'posts', { params: { id: `eq.${id}`, select: '*' } });
    if (!rows || !rows.length) return null;
    const row = rows[0];

    const { data: allComments } = await restFetch('GET', 'comments', { params: { post_id: `eq.${id}`, order: 'created_at.asc', select: '*' } });
    const commentCount = (allComments || []).filter((c) => !c.is_deleted).length;

    const voterKey = await currentVoterKey();
    const { data: voteRows } = await restFetch('GET', 'post_votes', { params: { post_id: `eq.${id}`, voter_key: `eq.${voterKey}`, select: 'value' } });
    const myVote = (voteRows && voteRows[0]) ? voteRows[0].value : 0;

    const avatars = await fetchAvatars([row.author_id]);
    const post = mapPostRow(row, commentCount, myVote, avatars[row.author_id]);
    post.comments = await buildCommentTree(allComments || []);
    return post;
  },

  async createPost({ title, body, linkUrl, tags, attachments }) {
    title = (title || '').trim();
    if (!title) throw new Error('Title is required.');
    if (title.length > 300) throw new Error('Title is too long.');
    const cleanTags = [...new Set((tags || []).map((t) => t.trim().toLowerCase().slice(0, 32)).filter(Boolean))].slice(0, 12);
    const session = getSession();
    const authorId = session && session.user_id ? session.user_id : null;
    const authorName = authorId && state.user ? state.user.username : 'Anonymous';
    const { data } = await restFetch('POST', 'posts', {
      body: {
        author_id: authorId,
        author_name: authorName,
        title,
        body: sanitizeRichText(body || ''),
        link_url: (linkUrl || '').trim().slice(0, 2000) || null,
        tags: cleanTags,
        attachments: attachments || [],
      },
      prefer: 'return=representation',
    });
    return mapPostRow(data[0], 0, 0, state.user ? state.user.avatar : null);
  },

  async votePost(id, value) {
    const voterKey = await currentVoterKey();
    await rpcFetch('cast_post_vote', { p_post_id: id, p_voter_key: voterKey, p_value: value });
    const { data: rows } = await restFetch('GET', 'posts', { params: { id: `eq.${id}`, select: 'upvotes,downvotes' } });
    const row = rows && rows[0];
    return { score: row ? row.upvotes - row.downvotes : 0 };
  },

  async deletePost(id) {
    const { data } = await restFetch('PATCH', 'posts', { params: { id: `eq.${id}` }, body: { is_deleted: true }, prefer: 'return=representation' });
    if (!data || !data.length) throw new Error('Not authorized to delete this post.');
  },

  async restorePost(id) {
    const { data } = await restFetch('PATCH', 'posts', { params: { id: `eq.${id}` }, body: { is_deleted: false }, prefer: 'return=representation' });
    if (!data || !data.length) throw new Error('Admin access required to restore a post.');
  },

  async createComment(postId, parentId, body, attachments) {
    const cleanBody = sanitizeRichText((body || '').trim());
    if (!cleanBody && !(attachments && attachments.length)) throw new Error('Comment body or an attachment is required.');
    const session = getSession();
    const authorId = session && session.user_id ? session.user_id : null;
    const authorName = authorId && state.user ? state.user.username : 'Anonymous';
    const { data } = await restFetch('POST', 'comments', {
      body: {
        post_id: postId,
        parent_id: parentId || null,
        author_id: authorId,
        author_name: authorName,
        body: cleanBody,
        attachments: attachments || [],
      },
      prefer: 'return=representation',
    });
    return mapCommentRow(data[0], state.user ? state.user.avatar : null);
  },

  async voteComment(id, value) {
    const voterKey = await currentVoterKey();
    await rpcFetch('cast_comment_vote', { p_comment_id: id, p_voter_key: voterKey, p_value: value });
    const { data: rows } = await restFetch('GET', 'comments', { params: { id: `eq.${id}`, select: 'upvotes,downvotes' } });
    const row = rows && rows[0];
    return { score: row ? row.upvotes - row.downvotes : 0 };
  },

  async deleteComment(id) {
    const { data } = await restFetch('PATCH', 'comments', { params: { id: `eq.${id}` }, body: { is_deleted: true }, prefer: 'return=representation' });
    if (!data || !data.length) throw new Error('Not authorized to delete this comment.');
  },

  async adminListUsers() {
    const { data } = await restFetch('GET', 'profiles', { params: { select: '*', order: 'created_at.asc' } });
    return (data || []).map((p) => ({ id: p.id, username: p.username, role: p.role, avatar: p.avatar_data_url, created_at: p.created_at }));
  },

  async adminSetUserRole(userId, role) {
    if (!['user', 'admin'].includes(role)) throw new Error('Invalid role.');
    const { data } = await restFetch('PATCH', 'profiles', { params: { id: `eq.${userId}` }, body: { role }, prefer: 'return=representation' });
    if (!data || !data.length) throw new Error('Admin access required.');
  },

  async adminStats() {
    const countFor = async (table, params) => {
      const { headers } = await restFetch('GET', table, {
        params: { ...params, select: 'id', limit: '1' },
        headers: { Prefer: 'count=exact' },
      });
      const range = headers.get('content-range') || '0/0';
      return parseInt(range.split('/').pop(), 10) || 0;
    };
    const [users, posts, deletedPosts, comments, anonymousPosts] = await Promise.all([
      countFor('profiles', {}),
      countFor('posts', { is_deleted: 'eq.false' }),
      countFor('posts', { is_deleted: 'eq.true' }),
      countFor('comments', { is_deleted: 'eq.false' }),
      countFor('posts', { is_deleted: 'eq.false', author_id: 'is.null' }),
    ]);
    return { users, posts, deletedPosts, comments, anonymousPosts };
  },

  async adminListPosts() {
    const { data: rows } = await restFetch('GET', 'posts', { params: { order: 'created_at.desc', limit: '200', select: '*' } });
    const { data: commentRows } = await restFetch('GET', 'comments', { params: { select: 'post_id' } });
    const counts = {};
    (commentRows || []).forEach((c) => { counts[c.post_id] = (counts[c.post_id] || 0) + 1; });
    return (rows || []).map((row) => mapPostRow(row, counts[row.id] || 0));
  },
};


function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function avatarHtml(avatarDataUrl, name, sizeClass = '') {
  const cls = `avatar ${sizeClass}`.trim();
  if (avatarDataUrl) {
    return `<img class="${cls}" src="${avatarDataUrl}" alt="${escapeHtml(name || 'avatar')}">`;
  }
  const initial = escapeHtml((name || '?').trim().charAt(0).toUpperCase() || '?');
  return `<span class="${cls} avatar-placeholder" aria-hidden="true">${initial}</span>`;
}

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const steps = [
    [60, 'sec'], [60, 'min'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year'],
  ];
  let value = seconds, unit = 'sec';
  for (const [size, label] of steps) {
    if (value < size) { unit = label; break; }
    value = Math.floor(value / size);
    unit = label;
  }
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 3200);
}

/* ---------------------------------------------------------------------- */
/* State                                                                   */
/* ---------------------------------------------------------------------- */

const state = {
  user: null,
  sort: 'hot',
  tag: null,
  query: null,
  offset: 0,
  limit: 30,
  pendingAttachments: [],
  authMode: 'login',
};

/* ---------------------------------------------------------------------- */
/* Auth                                                                    */
/* ---------------------------------------------------------------------- */

async function refreshMe() {
  try {
    state.user = await pulse.me();
  } catch (_) {
    state.user = null;
  }
  renderAuthNav();
}

function renderAuthNav() {
  const nav = document.getElementById('auth-nav');
  if (state.user) {
    nav.innerHTML = `
      <button class="nav-avatar-btn" id="avatar-nav-btn" type="button" title="Change profile picture">${avatarHtml(state.user.avatar, state.user.username)}</button>
      <span class="muted small">Hi, <strong>${escapeHtml(state.user.username)}</strong>${state.user.role === 'admin' ? ' <span title="Administrator">🛡️</span>' : ''}</span>
      ${state.user.role === 'admin' ? '<button class="btn ghost" id="admin-nav-btn" type="button">Admin</button>' : ''}
      <button class="btn ghost" id="logout-btn" type="button">Log out</button>`;
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('avatar-nav-btn').addEventListener('click', openAvatarModal);
    const adminBtn = document.getElementById('admin-nav-btn');
    if (adminBtn) adminBtn.addEventListener('click', showAdminView);
  } else {
    nav.innerHTML = `
      <button class="btn ghost" id="login-btn" type="button">Log in</button>
      <button class="btn primary" id="register-btn" type="button">Sign up</button>`;
    document.getElementById('login-btn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('register-btn').addEventListener('click', () => openAuthModal('register'));
  }
}

function openAvatarModal() {
  if (!state.user) return;
  const modal = document.getElementById('avatar-modal');
  const img = document.getElementById('avatar-preview-img');
  const placeholder = document.getElementById('avatar-preview-placeholder');
  const fileInput = document.getElementById('avatar-file-input');
  const errorEl = document.getElementById('avatar-error');
  fileInput.value = '';
  errorEl.hidden = true;
  let pendingDataUrl = state.user.avatar || null;

  function refreshPreview() {
    if (pendingDataUrl) {
      img.src = pendingDataUrl;
      img.hidden = false;
      placeholder.hidden = true;
    } else {
      img.hidden = true;
      placeholder.hidden = false;
      placeholder.textContent = (state.user.username || '?').trim().charAt(0).toUpperCase() || '?';
    }
  }
  refreshPreview();

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { errorEl.textContent = 'Please choose an image file.'; errorEl.hidden = false; return; }
    if (file.size > 256 * 1024) { errorEl.textContent = 'Image must be smaller than 256KB.'; errorEl.hidden = false; return; }
    errorEl.hidden = true;
    pendingDataUrl = await readFileAsDataUrl(file);
    refreshPreview();
  };

  document.getElementById('avatar-remove-btn').onclick = async () => {
    try {
      await pulse.setAvatar(null);
      state.user.avatar = null;
      renderAuthNav();
      modal.close();
      toast('Profile picture removed.');
    } catch (err) { errorEl.textContent = err.message; errorEl.hidden = false; }
  };

  document.getElementById('avatar-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!pendingDataUrl) { modal.close(); return; }
    try {
      await pulse.setAvatar(pendingDataUrl);
      state.user.avatar = pendingDataUrl;
      renderAuthNav();
      modal.close();
      toast('Profile picture updated.');
    } catch (err) { errorEl.textContent = err.message; errorEl.hidden = false; }
  };

  modal.showModal();
}

async function logout() {
  try { await pulse.logout(); } catch (_) { /* ignore */ }
  state.user = null;
  renderAuthNav();
  showFeedView();
  loadTags();
  loadFeed(true);
  toast('Logged out.');
}

function openAuthModal(mode) {
  state.authMode = mode;
  const modal = document.getElementById('auth-modal');
  document.getElementById('auth-modal-title').textContent = mode === 'login' ? 'Log in' : 'Sign up';
  document.getElementById('auth-submit').textContent = mode === 'login' ? 'Log in' : 'Create account';
  document.getElementById('auth-switch-mode').textContent = mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in';
  document.getElementById('auth-error').hidden = true;
  document.getElementById('auth-form').reset();
  modal.showModal();
}

document.getElementById('auth-switch-mode').addEventListener('click', () => {
  openAuthModal(state.authMode === 'login' ? 'register' : 'login');
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.hidden = true;
  try {
    const user = state.authMode === 'login' ? await pulse.login(username, password) : await pulse.register(username, password);
    state.user = user;
    renderAuthNav();
    document.getElementById('auth-modal').close();
    toast(state.authMode === 'login' ? `Welcome back, ${user.username}.` : `Account created. Welcome, ${user.username}.`);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

/* ---------------------------------------------------------------------- */
/* Modals: generic close handling                                         */
/* ---------------------------------------------------------------------- */

document.querySelectorAll('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', () => btn.closest('dialog').close());
});
document.getElementById('post-login-hint').addEventListener('click', () => {
  document.getElementById('post-modal').close();
  openAuthModal('login');
});

/* ---------------------------------------------------------------------- */
/* Tags & sort controls                                                    */
/* ---------------------------------------------------------------------- */

async function loadTags() {
  const el = document.getElementById('tag-cloud');
  try {
    const tags = await pulse.listTags();
    if (!tags.length) { el.innerHTML = '<p class="muted small">No tags yet.</p>'; return; }
    el.innerHTML = tags.map((t) => `
      <button class="tag-chip${state.tag === t.tag ? ' is-active' : ''}" data-tag="${escapeHtml(t.tag)}" type="button">
        #${escapeHtml(t.tag)} <span class="count">${t.count}</span>
      </button>`).join('');
    el.querySelectorAll('.tag-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.tag = state.tag === chip.dataset.tag ? null : chip.dataset.tag;
        state.offset = 0;
        renderActiveFilter();
        loadTags();
        loadFeed(true);
      });
    });
  } catch (err) {
    el.innerHTML = `<p class="muted small">Could not load tags.</p>`;
  }
}

function renderActiveFilter() {
  const panel = document.getElementById('active-filter-panel');
  const container = document.getElementById('active-filter');
  const chips = [];
  if (state.tag) chips.push(`<span class="tag-chip is-active">#${escapeHtml(state.tag)}</span>`);
  if (state.query) chips.push(`<span class="tag-chip is-active">"${escapeHtml(state.query)}"</span>`);
  if (!chips.length) { panel.hidden = true; return; }
  panel.hidden = false;
  container.innerHTML = chips.join('') + '<button class="btn ghost small" id="clear-filter-btn" type="button">Clear</button>';
  document.getElementById('clear-filter-btn').addEventListener('click', () => {
    state.tag = null; state.query = null; state.offset = 0;
    document.getElementById('search-input').value = '';
    renderActiveFilter(); loadTags(); loadFeed(true);
  });
}

document.getElementById('sort-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.sort-tab');
  if (!btn) return;
  document.querySelectorAll('.sort-tab').forEach((t) => t.classList.remove('is-active'));
  btn.classList.add('is-active');
  state.sort = btn.dataset.sort;
  state.offset = 0;
  loadFeed(true);
});

document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  state.query = document.getElementById('search-input').value.trim() || null;
  state.offset = 0;
  renderActiveFilter();
  loadFeed(true);
  showFeedView();
});

/* ---------------------------------------------------------------------- */
/* Feed rendering                                                          */
/* ---------------------------------------------------------------------- */

function postUrl(id) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('post', id);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function feedUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('post');
  url.hash = '';
  return `${url.pathname}${url.search}`;
}

function attachmentIsImage(att) {
  return (att.mimeType || '').startsWith('image/');
}

function renderAttachments(attachments) {
  if (!attachments || !attachments.length) return '';
  return attachments.map((att) => {
    if (attachmentIsImage(att)) {
      return `<img class="attachment-media" src="${att.dataUrl}" alt="${escapeHtml(att.name || 'attachment')}" loading="lazy">`;
    }
    if ((att.mimeType || '').startsWith('audio/')) {
      return `<audio class="attachment-media" controls src="${att.dataUrl}"></audio>`;
    }
    if ((att.mimeType || '').startsWith('video/')) {
      return `<video class="attachment-media" controls src="${att.dataUrl}"></video>`;
    }
    return `<a class="attachment-chip" href="${att.dataUrl}" download="${escapeHtml(att.name || 'file')}">📎 ${escapeHtml(att.name || 'file')}</a>`;
  }).join('');
}

function postCardHtml(post) {
  const excerpt = post.body ? post.body : '';
  const tags = (post.tags || []).map((t) => `<button class="tag-chip" data-tag="${escapeHtml(t)}" type="button">#${escapeHtml(t)}</button>`).join('');
  const canModerate = state.user && (state.user.role === 'admin' || state.user.id === post.authorId);
  return `
  <article class="post-card" data-id="${post.id}">
    <div class="vote-col">
      <button class="vote-btn up${post.myVote === 1 ? ' is-active-up' : ''}" data-vote="1" aria-label="Upvote">▲</button>
      <span class="vote-score">${post.score}</span>
      <button class="vote-btn down${post.myVote === -1 ? ' is-active-down' : ''}" data-vote="-1" aria-label="Downvote">▼</button>
    </div>
    <div class="post-body-col">
      <h3 class="post-title"><a href="${postUrl(post.id)}" data-open="${post.id}">${escapeHtml(post.title)}</a></h3>
      <div class="post-meta">
        <span class="author-line">${avatarHtml(post.authorAvatar, post.authorName, 'avatar-sm')} by ${escapeHtml(post.authorName)}</span>
        <span>${timeAgo(post.createdAt)}</span>
        ${post.linkUrl ? `<a href="${escapeHtml(post.linkUrl)}" target="_blank" rel="noopener noreferrer">🔗 link</a>` : ''}
      </div>
      ${excerpt ? `<div class="post-excerpt">${excerpt}</div>` : ''}
      ${renderAttachments(post.attachments)}
      ${tags ? `<div class="post-tags">${tags}</div>` : ''}
      <div class="post-actions">
        <button data-open="${post.id}" type="button">💬 ${post.commentCount} comments</button>
        ${canModerate ? `<button class="danger" data-delete-post="${post.id}" type="button">🗑 Delete</button>` : ''}
      </div>
    </div>
  </article>`;
}

async function loadFeed(reset) {
  const list = document.getElementById('feed-list');
  if (reset) { state.offset = 0; list.innerHTML = '<p class="muted">Loading posts…</p>'; }
  try {
    const posts = await pulse.listPosts({ sort: state.sort, tag: state.tag, query: state.query, limit: state.limit, offset: state.offset });
    if (reset) list.innerHTML = '';
    if (!posts.length && reset) {
      list.innerHTML = '<p class="muted">No posts match yet. Be the first to submit one!</p>';
    } else {
      list.insertAdjacentHTML('beforeend', posts.map(postCardHtml).join(''));
    }
    document.getElementById('load-more-btn').hidden = posts.length < state.limit;
    state.offset += posts.length;
    bindFeedEvents();
  } catch (err) {
    list.innerHTML = `<p class="form-error">Failed to load posts: ${escapeHtml(err.message)}</p>`;
  }
}

function bindFeedEvents() {
  document.querySelectorAll('.post-card').forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-vote]').forEach((btn) => {
      btn.onclick = () => castVote('post', id, Number(btn.dataset.vote), card);
    });
    card.querySelectorAll('[data-open]').forEach((el) => {
      el.onclick = (e) => { e.preventDefault(); openPost(id); };
    });
    const del = card.querySelector('[data-delete-post]');
    if (del) del.onclick = () => deletePost(id);
    card.querySelectorAll('.tag-chip[data-tag]').forEach((chip) => {
      chip.onclick = () => {
        state.tag = chip.dataset.tag; state.offset = 0;
        renderActiveFilter(); loadTags(); loadFeed(true);
      };
    });
  });
}

async function castVote(kind, id, value, cardEl) {
  if (!cardEl) return;
  const upBtn = cardEl.querySelector('.vote-btn.up, .comment-vote.up');
  const wasActive = upBtn && upBtn.classList.contains('is-active-up');
  const finalValue = (kind === 'post' && wasActive && value === 1) ? 0 : value;
  try {
    const result = kind === 'post' ? await pulse.votePost(id, finalValue) : await pulse.voteComment(id, finalValue);
    const scoreEl = cardEl.querySelector('.vote-score, .comment-score');
    if (scoreEl) scoreEl.textContent = result.score;
    cardEl.querySelectorAll('.vote-btn, .comment-vote').forEach((b) => b.classList.remove('is-active-up', 'is-active-down'));
    if (finalValue === 1) cardEl.querySelector('[data-vote="1"]')?.classList.add('is-active-up');
    if (finalValue === -1) cardEl.querySelector('[data-vote="-1"]')?.classList.add('is-active-down');
  } catch (err) {
    toast(`Vote failed: ${err.message}`);
  }
}

async function deletePost(id) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    await pulse.deletePost(id);
    toast('Post deleted.');
    loadFeed(true);
  } catch (err) {
    toast(`Could not delete: ${err.message}`);
  }
}

document.getElementById('load-more-btn').addEventListener('click', () => loadFeed(false));

/* ---------------------------------------------------------------------- */
/* Post detail + comments                                                  */
/* ---------------------------------------------------------------------- */

function showFeedView() {
  document.getElementById('feed-view').hidden = false;
  document.getElementById('post-view').hidden = true;
  document.getElementById('admin-view').hidden = true;
  history.replaceState(null, '', feedUrl());
}

function showPostView() {
  document.getElementById('feed-view').hidden = true;
  document.getElementById('post-view').hidden = false;
  document.getElementById('admin-view').hidden = true;
}

function showAdminView() {
  if (!state.user || state.user.role !== 'admin') { toast('Admin access required.'); return; }
  document.getElementById('feed-view').hidden = true;
  document.getElementById('post-view').hidden = true;
  document.getElementById('admin-view').hidden = false;
  renderAdminView('overview');
}

async function renderAdminView(tab) {
  const root = document.getElementById('admin-view');
  root.innerHTML = `
    <button class="btn ghost post-detail-back" id="admin-back-btn" type="button">← Back to feed</button>
    <h2>Admin screen</h2>
    <div class="admin-tabs">
      <button class="admin-tab${tab === 'overview' ? ' is-active' : ''}" data-tab="overview" type="button">Overview</button>
      <button class="admin-tab${tab === 'users' ? ' is-active' : ''}" data-tab="users" type="button">Users</button>
      <button class="admin-tab${tab === 'posts' ? ' is-active' : ''}" data-tab="posts" type="button">Posts &amp; moderation</button>
    </div>
    <div id="admin-tab-content"><p class="muted">Loading…</p></div>
  `;
  document.getElementById('admin-back-btn').onclick = showFeedView;
  root.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.onclick = () => renderAdminView(btn.dataset.tab);
  });

  const content = document.getElementById('admin-tab-content');
  try {
    if (tab === 'overview') {
      const stats = await pulse.adminStats();
      content.innerHTML = `
        <div class="admin-stats-grid">
          <div class="admin-stat-card"><div class="value">${stats.users}</div><div class="label">Registered users</div></div>
          <div class="admin-stat-card"><div class="value">${stats.posts}</div><div class="label">Active posts</div></div>
          <div class="admin-stat-card"><div class="value">${stats.anonymousPosts}</div><div class="label">Anonymous posts</div></div>
          <div class="admin-stat-card"><div class="value">${stats.comments}</div><div class="label">Active comments</div></div>
          <div class="admin-stat-card"><div class="value">${stats.deletedPosts}</div><div class="label">Deleted posts</div></div>
        </div>`;
    } else if (tab === 'users') {
      const users = await pulse.adminListUsers();
      content.innerHTML = `
        <table class="admin-table">
          <thead><tr><th></th><th>Username</th><th>Role</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            ${users.map((u) => `
              <tr data-id="${u.id}">
                <td>${avatarHtml(u.avatar, u.username, 'avatar-sm')}</td>
                <td>${escapeHtml(u.username)}</td>
                <td><span class="role-badge${u.role === 'admin' ? ' admin' : ''}">${u.role}</span></td>
                <td>${timeAgo(u.created_at)}</td>
                <td>
                  ${u.id === state.user.id ? '<span class="muted small">(you)</span>' :
                    `<button class="btn ghost small" data-toggle-role="${u.id}" data-role="${u.role === 'admin' ? 'user' : 'admin'}" type="button">
                      Make ${u.role === 'admin' ? 'user' : 'admin'}
                    </button>`}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      content.querySelectorAll('[data-toggle-role]').forEach((btn) => {
        btn.onclick = async () => {
          try {
            await pulse.adminSetUserRole(btn.dataset.toggleRole, btn.dataset.role);
            toast('Role updated.');
            renderAdminView('users');
          } catch (err) { toast(`Could not update role: ${err.message}`); }
        };
      });
    } else if (tab === 'posts') {
      const posts = await pulse.adminListPosts();
      content.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Author</th><th>Score</th><th>Comments</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${posts.map((p) => `
              <tr data-id="${p.id}">
                <td><a href="${postUrl(p.id)}" data-open-admin-post="${p.id}">${escapeHtml(p.title)}</a></td>
                <td>${escapeHtml(p.authorName)}</td>
                <td>${p.score}</td>
                <td>${p.commentCount}</td>
                <td>${p.isDeleted ? '<span class="deleted-badge">deleted</span>' : 'active'}</td>
                <td>
                  ${p.isDeleted
                    ? `<button class="btn ghost small" data-restore="${p.id}" type="button">Restore</button>`
                    : `<button class="btn ghost small" data-admin-delete="${p.id}" type="button">Delete</button>`}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      content.querySelectorAll('[data-open-admin-post]').forEach((link) => {
        link.onclick = (e) => { e.preventDefault(); openPost(link.dataset.openAdminPost); };
      });
      content.querySelectorAll('[data-admin-delete]').forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm('Delete this post?')) return;
          try { await pulse.deletePost(btn.dataset.adminDelete); toast('Post deleted.'); renderAdminView('posts'); }
          catch (err) { toast(`Could not delete: ${err.message}`); }
        };
      });
      content.querySelectorAll('[data-restore]').forEach((btn) => {
        btn.onclick = async () => {
          try { await pulse.restorePost(btn.dataset.restore); toast('Post restored.'); renderAdminView('posts'); }
          catch (err) { toast(`Could not restore: ${err.message}`); }
        };
      });
    }
  } catch (err) {
    content.innerHTML = `<p class="form-error">Failed to load: ${escapeHtml(err.message)}</p>`;
  }
}

function commentHtml(comment) {
  const canModerate = state.user && (state.user.role === 'admin' || state.user.id === comment.authorId);
  const body = comment.isDeleted ? '<em>[deleted]</em>' : comment.body;
  return `
  <div class="comment${comment.isDeleted ? ' is-deleted' : ''}" data-id="${comment.id}">
    <div class="comment-header">
      ${!comment.isDeleted ? avatarHtml(comment.authorAvatar, comment.authorName, 'avatar-sm') : ''}
      <span class="comment-author">${escapeHtml(comment.authorName)}</span>
      <span>${timeAgo(comment.createdAt)}</span>
      <span class="comment-score">${comment.score}</span>
    </div>
    <div class="comment-body">${body}</div>
    ${renderAttachments(comment.attachments)}
    ${!comment.isDeleted ? `
    <div class="comment-actions">
      <button class="comment-vote up" data-vote="1" type="button">▲ Up</button>
      <button class="comment-vote down" data-vote="-1" type="button">▼ Down</button>
      <button data-reply="${comment.id}" type="button">Reply</button>
      ${canModerate ? `<button class="danger" data-delete-comment="${comment.id}" type="button">Delete</button>` : ''}
    </div>` : ''}
    <div class="reply-slot"></div>
    <div class="comment-replies">${(comment.replies || []).map(commentHtml).join('')}</div>
  </div>`;
}

function replyFormHtml(parentId) {
  return `
  <form class="reply-form" data-parent="${parentId || ''}">
    <div class="richtext-toolbar" data-target="reply-body-${parentId || 'root'}">
      <button type="button" data-cmd="bold"><b>B</b></button>
      <button type="button" data-cmd="italic"><i>I</i></button>
      <button type="button" data-cmd="insertUnorderedList">• List</button>
    </div>
    <div class="richtext-editor" contenteditable="true" id="reply-body-${parentId || 'root'}" data-placeholder="Write a reply…"></div>
    <input type="file" multiple class="reply-files">
    <div class="attachment-preview"></div>
    <footer style="margin-top:8px;">
      <button type="button" class="btn ghost small" data-cancel-reply>Cancel</button>
      <button type="submit" class="btn primary small">Reply</button>
    </footer>
  </form>`;
}

async function openPost(id, { updateUrl = true } = {}) {
  if (updateUrl) history.pushState(null, '', postUrl(id));
  const view = document.getElementById('post-view');
  view.innerHTML = '<p class="muted">Loading…</p>';
  showPostView();
  try {
    const post = await pulse.getPost(id);
    if (!post) throw new Error('Post not found.');
    const canModerate = state.user && (state.user.role === 'admin' || state.user.id === post.authorId);
    view.innerHTML = `
      <button class="btn ghost post-detail-back" id="back-to-feed" type="button">← Back to feed</button>
      <article class="post-detail" data-id="${post.id}">
        <div style="display:flex; gap:14px;">
          <div class="vote-col">
            <button class="vote-btn up${post.myVote === 1 ? ' is-active-up' : ''}" data-vote="1" type="button">▲</button>
            <span class="vote-score">${post.score}</span>
            <button class="vote-btn down${post.myVote === -1 ? ' is-active-down' : ''}" data-vote="-1" type="button">▼</button>
          </div>
          <div style="flex:1; min-width:0;">
            <h1 class="post-title">${escapeHtml(post.title)}</h1>
            <div class="post-meta">
              <span class="author-line">${avatarHtml(post.authorAvatar, post.authorName, 'avatar-sm')} by ${escapeHtml(post.authorName)}</span>
              <span>${timeAgo(post.createdAt)}</span>
              ${post.linkUrl ? `<a href="${escapeHtml(post.linkUrl)}" target="_blank" rel="noopener noreferrer">🔗 ${escapeHtml(post.linkUrl)}</a>` : ''}
            </div>
            ${post.body ? `<div class="post-excerpt">${post.body}</div>` : ''}
            ${renderAttachments(post.attachments)}
            <div class="post-tags">${(post.tags || []).map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>
            ${canModerate ? `<div class="post-actions"><button class="danger" id="delete-post-detail" type="button">🗑 Delete post</button></div>` : ''}
          </div>
        </div>
      </article>
      <h3>${post.commentCount} comment${post.commentCount === 1 ? '' : 's'}</h3>
      <div class="comment-form">${replyFormHtml(null)}</div>
      <div class="comment-thread" id="comment-thread">
        ${post.comments.length ? post.comments.map(commentHtml).join('') : '<p class="muted">No comments yet — start the discussion.</p>'}
      </div>
    `;
    document.getElementById('back-to-feed').onclick = showFeedView;
    bindRichTextToolbars(view);
    bindPostDetailEvents(post.id, view);
  } catch (err) {
    view.innerHTML = `<p class="form-error">Could not load post: ${escapeHtml(err.message)}</p>`;
  }
}

function bindPostDetailEvents(postId, root) {
  const detail = root.querySelector('.post-detail');
  detail.querySelectorAll('[data-vote]').forEach((btn) => {
    btn.onclick = () => castVote('post', postId, Number(btn.dataset.vote), detail);
  });
  const delBtn = root.querySelector('#delete-post-detail');
  if (delBtn) delBtn.onclick = async () => { await deletePost(postId); showFeedView(); };

  bindReplyForm(root.querySelector('.comment-form .reply-form'), postId, null);

  root.querySelectorAll('.comment').forEach((commentEl) => {
    const commentId = commentEl.dataset.id;
    commentEl.querySelectorAll('.comment-vote').forEach((btn) => {
      btn.onclick = () => castVote('comment', commentId, Number(btn.dataset.vote), commentEl);
    });
    const replyBtn = commentEl.querySelector('[data-reply]');
    if (replyBtn) {
      replyBtn.onclick = () => {
        const slot = commentEl.querySelector(':scope > .reply-slot');
        if (slot.childElementCount) { slot.innerHTML = ''; return; }
        slot.innerHTML = replyFormHtml(commentId);
        bindRichTextToolbars(slot);
        bindReplyForm(slot.querySelector('.reply-form'), postId, commentId);
      };
    }
    const delComment = commentEl.querySelector('[data-delete-comment]');
    if (delComment) {
      delComment.onclick = async () => {
        if (!confirm('Delete this comment?')) return;
        try {
          await pulse.deleteComment(commentId);
          toast('Comment deleted.');
          openPost(postId);
        } catch (err) { toast(`Could not delete: ${err.message}`); }
      };
    }
  });
}

function bindReplyForm(formEl, postId, parentId) {
  if (!formEl) return;
  const attachments = [];
  const editor = formEl.querySelector('.richtext-editor');
  const fileInput = formEl.querySelector('.reply-files');
  const preview = formEl.querySelector('.attachment-preview');
  const cancelBtn = formEl.querySelector('[data-cancel-reply]');

  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      for (const file of fileInput.files) {
        const dataUrl = await readFileAsDataUrl(file);
        attachments.push({ name: file.name, mimeType: file.type, size: file.size, dataUrl });
      }
      fileInput.value = '';
      renderAttachmentPreview(preview, attachments);
    });
  }
  if (cancelBtn) cancelBtn.onclick = () => { formEl.remove(); };

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = editor.innerHTML.trim();
    if (!body && !attachments.length) { toast('Write a reply or attach a file.'); return; }
    try {
      await pulse.createComment(postId, parentId, body, attachments);
      toast('Reply posted.');
      openPost(postId);
    } catch (err) {
      toast(`Could not post reply: ${err.message}`);
    }
  });
}

function renderAttachmentPreview(container, attachments) {
  if (!container) return;
  container.innerHTML = attachments.map((att, idx) => `
    <div class="attachment-item">
      ${att.mimeType.startsWith('image/') ? `<img src="${att.dataUrl}" alt="">` : `<span class="attachment-chip">📎 ${escapeHtml(att.name)}</span>`}
      <button type="button" class="remove-att" data-idx="${idx}">✕</button>
    </div>`).join('');
  container.querySelectorAll('.remove-att').forEach((btn) => {
    btn.onclick = () => { attachments.splice(Number(btn.dataset.idx), 1); renderAttachmentPreview(container, attachments); };
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function bindRichTextToolbars(root) {
  root.querySelectorAll('.richtext-toolbar').forEach((toolbar) => {
    const targetId = toolbar.dataset.target;
    const editor = targetId ? document.getElementById(targetId) : toolbar.nextElementSibling;
    toolbar.querySelectorAll('button').forEach((btn) => {
      btn.onclick = () => {
        editor.focus();
        if (btn.dataset.cmd === 'createLink') {
          const url = prompt('Link URL:');
          if (url) document.execCommand('createLink', false, url);
        } else {
          document.execCommand(btn.dataset.cmd, false, null);
        }
      };
    });
  });
}

/* ---------------------------------------------------------------------- */
/* Submit post modal                                                       */
/* ---------------------------------------------------------------------- */

document.getElementById('submit-post-btn').addEventListener('click', () => {
  state.pendingAttachments = [];
  document.getElementById('post-form').reset();
  document.getElementById('post-body').innerHTML = '';
  document.getElementById('post-attachment-preview').innerHTML = '';
  document.getElementById('post-error').hidden = true;
  document.getElementById('post-modal-sub').innerHTML = state.user
    ? `Posting as <strong>${escapeHtml(state.user.username)}</strong>.`
    : `Posting anonymously. <button type="button" class="link-btn" id="post-login-hint">Log in</button> to post under your username.`;
  const hint = document.getElementById('post-modal-sub').querySelector('#post-login-hint');
  if (hint) hint.onclick = () => { document.getElementById('post-modal').close(); openAuthModal('login'); };
  document.getElementById('post-modal').showModal();
});

bindRichTextToolbars(document);

document.getElementById('post-files').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    const dataUrl = await readFileAsDataUrl(file);
    state.pendingAttachments.push({ name: file.name, mimeType: file.type, size: file.size, dataUrl });
  }
  e.target.value = '';
  renderAttachmentPreview(document.getElementById('post-attachment-preview'), state.pendingAttachments);
});

document.getElementById('post-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('post-error');
  errorEl.hidden = true;
  const title = document.getElementById('post-title').value.trim();
  const linkUrl = document.getElementById('post-link').value.trim();
  const body = document.getElementById('post-body').innerHTML.trim();
  const tags = document.getElementById('post-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
  try {
    await pulse.createPost({ title, body, linkUrl, tags, attachments: state.pendingAttachments });
    document.getElementById('post-modal').close();
    toast('Post submitted.');
    state.sort = 'new';
    document.querySelectorAll('.sort-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.sort === 'new'));
    loadTags();
    showFeedView();
    loadFeed(true);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

/* ---------------------------------------------------------------------- */
/* Init                                                                     */
/* ---------------------------------------------------------------------- */

document.querySelector('.brand').addEventListener('click', (e) => {
  e.preventDefault();
  state.tag = null; state.query = null;
  document.getElementById('search-input').value = '';
  renderActiveFilter();
  showFeedView();
  loadFeed(true);
});

window.addEventListener('popstate', () => {
  const postId = new URLSearchParams(window.location.search).get('post');
  if (postId) {
    openPost(postId, { updateUrl: false });
  } else {
    showFeedView();
    loadFeed(true);
  }
});

(async function init() {
  await refreshMe();
  loadTags();
  const postId = new URLSearchParams(window.location.search).get('post');
  if (postId) openPost(postId, { updateUrl: false });
  else loadFeed(true);
})();
