'use strict';

/* Pulse — social news aggregator frontend (vanilla JS, no build step). */

/* Pulse talks directly to Supabase (PostgREST + Auth) over HTTPS — there is
 * no custom backend. Row Level Security in supabase-schema.sql enforces who
 * can read/write what; this module just wraps the raw REST/Auth calls. */
const CONFIG = window.PULSE_SUPABASE || {};
const EMAIL_DOMAIN = 'pulse.local';
const SESSION_KEY = 'pulse_session';
const TABLE_PREFIX = 'pulse_';
const MAX_POST_ATTACHMENTS = 4;
const MAX_ATTACHMENT_TOTAL_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;

function namespacedName(name, kind = 'table') {
  const value = String(name || '').trim();
  if (!value) return value;
  const prefix = kind === 'rpc' ? 'pulse_' : 'pulse_';
  return value.startsWith(prefix) ? value : `${prefix}${value}`;
}

function tableCandidates(name) {
  const value = String(name || '').trim();
  if (!value) return [value];
  return [namespacedName(value)];
}

function functionCandidates(name) {
  const value = String(name || '').trim();
  if (!value) return [value];
  return [namespacedName(value, 'rpc')];
}

function isMissingSchemaObjectError(message, candidate) {
  if (!message) return false;
  return message.includes(`'${candidate}'`) && (
    message.includes('in the schema cache') ||
    message.includes('does not exist') ||
    message.includes('Could not find the table') ||
    message.includes('Could not find the function')
  );
}

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

function normalizeRole(value) {
  const text = String(value ?? 'user').trim().toLowerCase();
  return text === 'admin' ? 'admin' : 'user';
}

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; }
}

function saveSession(data) {
  const user = data && data.user ? data.user : {};
  const metadata = user.user_metadata || {};
  const appMetadata = user.app_metadata || {};
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user_id: (data.user && data.user.id) || null,
    email: (data.user && data.user.email) || null,
    username: ((data.user && data.user.user_metadata && data.user.user_metadata.username) || ((data.user && data.user.email) ? data.user.email.split('@')[0] : null) || null),
    role: normalizeRole(metadata.role || metadata.user_role || appMetadata.role || appMetadata.user_role || 'user'),
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
  let lastError = null;

  for (const targetTable of tableCandidates(table)) {
    try {
      const res = await fetch(`${CONFIG.url}/rest/v1/${targetTable}${qs}`, {
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
    } catch (err) {
      lastError = err;
      throw err;
    }
  }

  throw lastError || new Error(`Could not resolve table '${table}'`);
}

async function rpcFetch(name, args) {
  const token = await getAccessToken();
  let lastError = null;

  for (const targetName of functionCandidates(name)) {
    try {
      const res = await fetch(`${CONFIG.url}/rest/v1/rpc/${targetName}`, {
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
    } catch (err) {
      lastError = err;
      throw err;
    }
  }

  throw lastError || new Error(`Could not resolve function '${name}'`);
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

function authUserToUser(authUser) {
  if (!authUser) return null;
  const metadata = authUser.user_metadata || {};
  const appMetadata = authUser.app_metadata || {};
  const email = authUser.email || '';
  const inferredUsername = (metadata.username || (email ? email.split('@')[0] : '') || 'user').trim();
  const username = inferredUsername || 'user';
  return {
    id: authUser.id,
    username,
    name: metadata.name || username,
    role: normalizeRole(metadata.role || metadata.user_role || appMetadata.role || appMetadata.user_role || 'user'),
    avatar: metadata.avatar_data_url || null,
    status: metadata.status || '',
    profileUrl: metadata.profile_url || '',
  };
}

function toUser(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    username: profile.username,
    name: profile.name || profile.username,
    role: normalizeRole(profile.role),
    avatar: profile.avatar_data_url,
    status: profile.status || '',
    profileUrl: profile.profile_url || '',
  };
}

async function fetchProfile(userId) {
  const { data } = await restFetch('GET', 'profiles', { params: { id: `eq.${userId}`, select: '*' } });
  return (data && data[0]) || null;
}

async function ensureProfileRow(userId, fallbackUsername) {
  let profile = await fetchProfile(userId);
  if (profile) return profile;

  const username = (fallbackUsername || `user-${String(userId).slice(0, 8)}`).trim();
  let lastError = null;
  const candidates = [username, `user-${String(userId).slice(0, 8)}`];
  for (const candidate of [...new Set(candidates)]) {
    try {
      const { data } = await restFetch('POST', 'profiles', {
        body: {
          id: userId,
          username: candidate,
          name: candidate,
        },
        prefer: 'return=representation',
      });
      profile = (data && data[0]) || null;
      if (profile) return profile;
    } catch (err) {
      lastError = err;
      profile = await fetchProfile(userId);
      if (profile) return profile;
    }
  }
  throw new Error(`Profile could not be created: ${lastError ? lastError.message : 'the database returned no row'}`);
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
    if (profile) return toUser(profile);
    const ensured = await ensureProfileRow(data.user.id, username);
    return toUser(ensured) || authUserToUser(data.user);
  },

  async login(username, password) {
    const data = await authFetch('token?grant_type=password', { email: usernameToEmail(username), password });
    saveSession(data);
    const profile = await fetchProfile(data.user.id);
    if (profile) return toUser(profile);
    const ensured = await ensureProfileRow(data.user.id, username);
    return toUser(ensured) || authUserToUser(data.user);
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
    let profile = await fetchProfile(session.user_id);
    if (!profile) {
      profile = await ensureProfileRow(session.user_id, session.username || (session.email ? session.email.split('@')[0] : null));
    }
    if (profile) return toUser(profile);
    if (session.role === 'admin') {
      return authUserToUser({
        id: session.user_id,
        email: session.email || `${session.username || 'user'}@${EMAIL_DOMAIN}`,
        user_metadata: { username: session.username || 'user', role: 'admin' },
      });
    }
    return null;
  },

  async isAdmin() {
    const session = getSession();
    if (!session || !session.user_id) return false;
    if (session.role === 'admin') return true;
    try {
      return await rpcFetch('is_admin', {}) === true;
    } catch (_) {
      return false;
    }
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
    await ensureProfileRow(session.user_id, session.username || (session.email ? session.email.split('@')[0] : null));
    await restFetch('PATCH', 'profiles', {
      params: { id: `eq.${session.user_id}` },
      body: { avatar_data_url: avatarDataUrl },
      prefer: 'return=minimal',
    });
  },

  async updateProfile({ username, name, status, profileUrl, avatar }) {
    const session = getSession();
    if (!session || !session.user_id) throw new Error('Log in to edit your profile.');
    username = (username || '').trim();
    name = (name || '').trim();
    status = (status || '').trim();
    profileUrl = (profileUrl || '').trim();
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
      throw new Error('Username must be 3-32 characters (letters, numbers, _ . -).');
    }
    if (name.length > 80) throw new Error('Display name must be 80 characters or fewer.');
    if (status.length > 160) throw new Error('Status must be 160 characters or fewer.');
    if (profileUrl) {
      let parsedUrl;
      try { parsedUrl = new URL(profileUrl); } catch (_) { throw new Error('Profile URL must be a valid URL.'); }
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Profile URL must use http or https.');
      if (profileUrl.length > 2000) throw new Error('Profile URL must be 2000 characters or fewer.');
    }
    if (avatar && (!/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/.test(avatar)
      || (avatar.length * 3) / 4 > 256 * 1024)) {
      throw new Error('Avatar must be a supported image smaller than 256KB.');
    }
    const existing = await ensureProfileRow(session.user_id, session.username || (session.email ? session.email.split('@')[0] : null));
    if (!existing) throw new Error('Profile could not be created. Refresh the page and try again.');
    await restFetch('PATCH', 'profiles', {
      params: { id: `eq.${session.user_id}` },
      body: { username, name, status, profile_url: profileUrl || null, avatar_data_url: avatar || null },
      prefer: 'return=minimal',
    });
    const updated = await fetchProfile(session.user_id);
    if (!updated || updated.username !== username || updated.name !== name
      || updated.status !== status || (updated.profile_url || '') !== (profileUrl || '')
      || (updated.avatar_data_url || null) !== (avatar || null)) {
      throw new Error('Profile could not be updated. Check that the profile schema and permissions are current.');
    }
    return toUser(updated);
  },

  async listTags() {
    const { data } = await restFetch('GET', 'posts', {
      params: {
        is_deleted: 'eq.false',
        select: 'tags',
        order: 'created_at.desc',
        limit: '200',
      },
    });
    const counts = {};
    (data || []).forEach((row) => {
      const rawTags = Array.isArray(row.tags) ? row.tags : [];
      rawTags.forEach((tag) => {
        const normalizedTag = String(tag || '').trim().toLowerCase();
        if (normalizedTag) counts[normalizedTag] = (counts[normalizedTag] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  },

  async searchProfiles(query, limit = 20) {
    const cleanQuery = String(query || '').trim().replace(/[*,()]/g, '');
    if (!cleanQuery) return [];
    try {
      const { data } = await restFetch('GET', 'profiles', {
        params: {
          or: `(username.ilike.*${cleanQuery}*,name.ilike.*${cleanQuery}*)`,
          select: 'id,username,name,role,avatar_data_url,status,profile_url',
          order: 'name.asc',
          limit: String(limit),
        },
      });
      return (data || []).map(toUser);
    } catch (_) {
      // Keep username search working while an existing project refreshes its schema.
      const { data } = await restFetch('GET', 'profiles', {
        params: {
          username: `ilike.*${cleanQuery}*`,
          select: 'id,username,role,avatar_data_url',
          order: 'username.asc',
          limit: String(limit),
        },
      });
      return (data || []).map(toUser);
    }
  },

  async listPosts({ sort = 'hot', tag = null, query = null, limit = 30, offset = 0 } = {}) {
    const pageLimit = Math.min(Math.max(30, limit) + offset + 50, 300);
    const { data: rows } = await restFetch('GET', 'posts', {
      params: {
        is_deleted: 'eq.false',
        select: '*',
        order: 'created_at.desc',
        limit: String(pageLimit),
      },
    });
    const posts = rows || [];
    const { data: commentRows } = await restFetch('GET', 'comments', { params: { is_deleted: 'eq.false', select: 'post_id', limit: '500' } });
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

    const { data: allComments } = await restFetch('GET', 'comments', {
      params: { post_id: `eq.${id}`, order: 'created_at.asc', select: '*', limit: '200' },
    });
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
    const safeAttachments = validateAttachments(attachments);
    const session = getSession();
    const authorId = session && session.user_id ? session.user_id : null;
    const authorName = authorId && state.user ? state.user.name : 'Anonymous';
    const { data } = await restFetch('POST', 'posts', {
      body: {
        author_id: authorId,
        author_name: authorName,
        title,
        body: sanitizeRichText(body || ''),
        link_url: (linkUrl || '').trim().slice(0, 2000) || null,
        tags: cleanTags,
        attachments: safeAttachments,
      },
      prefer: 'return=representation',
    });
    return mapPostRow(data[0], 0, 0, state.user ? state.user.avatar : null);
  },

  async updatePost(id, { title, body, linkUrl, tags, attachments }) {
    title = (title || '').trim();
    if (!title) throw new Error('Title is required.');
    if (title.length > 300) throw new Error('Title is too long.');
    const cleanTags = [...new Set((tags || []).map((t) => t.trim().toLowerCase().slice(0, 32)).filter(Boolean))].slice(0, 12);
    const safeAttachments = validateAttachments(attachments);
    const { data } = await restFetch('PATCH', 'posts', {
      params: { id: `eq.${id}` },
      body: {
        title,
        body: sanitizeRichText(body || ''),
        link_url: (linkUrl || '').trim().slice(0, 2000) || null,
        tags: cleanTags,
        attachments: safeAttachments,
      },
      prefer: 'return=representation',
    });
    if (!data || !data.length) throw new Error('Not authorized to edit this post.');
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
    const { data } = await restFetch('DELETE', 'posts', { params: { id: `eq.${id}` }, prefer: 'return=representation' });
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
    return (data || []).map((p) => ({ id: p.id, username: p.username, name: p.name || p.username, role: p.role, avatar: p.avatar_data_url, created_at: p.created_at }));
  },

  async adminSetUserRole(userId, role) {
    if (!['user', 'admin'].includes(role)) throw new Error('Invalid role.');
    const { data } = await restFetch('PATCH', 'profiles', { params: { id: `eq.${userId}` }, body: { role }, prefer: 'return=representation' });
    if (!data || !data.length) throw new Error('Admin access required.');
  },

  async adminSetPostAuthor(postId, authorId, authorName) {
    const nextAuthorId = authorId || null;
    const { data } = await restFetch('PATCH', 'posts', {
      params: { id: `eq.${postId}` },
      body: { author_id: nextAuthorId, author_name: nextAuthorId ? authorName : 'Anonymous' },
      prefer: 'return=representation',
    });
    if (!data || !data.length) throw new Error('Admin access required to change post ownership.');
    return data[0];
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

function userUrl(id) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('user', id);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function profileLinkHtml(id, avatar, name, sizeClass = '') {
  if (!id) return escapeHtml(name || 'Anonymous');
  return `<a class="profile-link" href="${userUrl(id)}" data-profile="${escapeHtml(id)}">${avatarHtml(avatar, name, sizeClass)}<span>${escapeHtml(name || 'Anonymous')}</span></a>`;
}

function safeProfileUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch (_) { return null; }
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
  editingPostId: null,
  authMode: 'login',
  authRevision: 0,
  feedLoaded: false,
};

/* ---------------------------------------------------------------------- */
/* Auth                                                                    */
/* ---------------------------------------------------------------------- */

async function refreshMe() {
  try {
    state.user = await pulse.me();
    if (state.user && state.user.role !== 'admin' && await pulse.isAdmin()) {
      state.user.role = 'admin';
    }
  } catch (_) {
    state.user = null;
  }
  renderAuthNav();
}

function renderAuthNav() {
  const nav = document.getElementById('auth-nav');
  if (state.user) {
    nav.innerHTML = `
      <button class="nav-avatar-btn" id="avatar-nav-btn" type="button" title="View profile">${avatarHtml(state.user.avatar, state.user.username)}</button>
      <span class="muted small">Hi, <strong>${escapeHtml(state.user.name)}</strong>${state.user.role === 'admin' ? ' <span title="Administrator">🛡️</span>' : ''}</span>
      <button class="btn ghost" id="profile-nav-btn" type="button">Profile</button>
      ${state.user.role === 'admin' ? '<button class="btn ghost" id="admin-nav-btn" type="button">Admin</button>' : ''}
      <button class="btn ghost" id="logout-btn" type="button">Log out</button>`;
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('avatar-nav-btn').addEventListener('click', showProfileView);
    document.getElementById('profile-nav-btn').addEventListener('click', showProfileView);
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
  state.authRevision += 1;
  state.user = null;
  resetAdminAccess();
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
    state.authRevision += 1;
    state.user = user;
    if (state.user && state.user.role !== 'admin' && await pulse.isAdmin()) {
      state.user.role = 'admin';
    }
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
document.getElementById('carousel-modal').addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.currentTarget.close();
    return;
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const selector = event.key === 'ArrowLeft' ? '[data-carousel-prev]' : '[data-carousel-next]';
  event.currentTarget.querySelector(selector)?.click();
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
    el.innerHTML = `<p class="muted small">Could not load tags. <button class="link-btn" id="retry-tags-btn" type="button">Retry</button></p>`;
    document.getElementById('retry-tags-btn').addEventListener('click', loadTags);
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
    renderSearchResults([], []);
    renderActiveFilter(); loadTags(); loadFeed(true);
  });
}

function renderSearchResults(profiles, tags) {
  const el = document.getElementById('profile-results');
  if (!profiles.length && !tags.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `
    ${profiles.length ? `<section class="search-result-section">
      <div class="search-section-heading"><h2>People</h2><span class="muted small">${profiles.length} match${profiles.length === 1 ? '' : 'es'}</span></div>
      <div class="profile-search-results">
        ${profiles.map((profile) => `
          <a class="profile-search-result" href="${userUrl(profile.id)}" data-profile="${escapeHtml(profile.id)}">
            ${avatarHtml(profile.avatar, profile.name, 'avatar-sm')}
            <span><strong>${escapeHtml(profile.name)}</strong><small>@${escapeHtml(profile.username)}${profile.status ? ` · ${escapeHtml(profile.status)}` : ''}</small></span>
          </a>`).join('')}
      </div>
    </section>` : ''}
    ${tags.length ? `<section class="search-result-section">
      <div class="search-section-heading"><h2>Tags</h2><span class="muted small">${tags.length} match${tags.length === 1 ? '' : 'es'}</span></div>
      <div class="search-tag-results">
        ${tags.map((item) => `<button class="tag-chip" data-search-tag="${escapeHtml(item.tag)}" type="button">#${escapeHtml(item.tag)} <span class="count">${item.count}</span></button>`).join('')}
      </div>
    </section>` : ''}`;
  el.querySelectorAll('[data-search-tag]').forEach((tagButton) => {
    tagButton.onclick = () => {
      state.tag = tagButton.dataset.searchTag;
      state.offset = 0;
      renderActiveFilter();
      loadTags();
      loadFeed(true);
    };
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

document.getElementById('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  state.query = document.getElementById('search-input').value.trim() || null;
  state.offset = 0;
  renderActiveFilter();
  let profiles = [];
  let tags = [];
  if (state.query) {
    const results = await Promise.allSettled([pulse.searchProfiles(state.query), pulse.listTags()]);
    if (results[0].status === 'fulfilled') profiles = results[0].value;
    if (results[1].status === 'fulfilled') {
      const query = state.query.toLowerCase().replace(/^#/, '');
      tags = results[1].value.filter((item) => item.tag.toLowerCase().includes(query));
    }
  }
  renderSearchResults(profiles, tags);
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

function absolutePostUrl(id) {
  return new URL(postUrl(id), window.location.href).href;
}

function feedUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('post');
  url.searchParams.delete('user');
  url.hash = '';
  return `${url.pathname}${url.search}`;
}

function attachmentIsImage(att) {
  return (att.mimeType || '').startsWith('image/');
}

async function attachmentToFile(att) {
  const res = await fetch(att.dataUrl);
  const blob = await res.blob();
  return new File([blob], att.name || 'pulse-image', { type: blob.type || att.mimeType || 'application/octet-stream' });
}

function postShareText(post) {
  const excerpt = plainExcerpt(post.body, 360);
  return [post.title, excerpt].filter(Boolean).join('\n\n');
}

async function sharePost(post) {
  const url = absolutePostUrl(post.id);
  const text = postShareText(post);
  const shareData = { title: post.title, text, url };
  try {
    if (navigator.share) {
      const imageAttachments = (post.attachments || []).filter(attachmentIsImage);
      if (imageAttachments.length && navigator.canShare && typeof File !== 'undefined') {
        try {
          const files = await Promise.all(imageAttachments.map(attachmentToFile));
          const shareDataWithFiles = { ...shareData, files };
          if (navigator.canShare(shareDataWithFiles)) {
            await navigator.share(shareDataWithFiles);
            return;
          }
        } catch (_) { /* Fall back to sharing the post text and link. */ }
      }
      await navigator.share(shareData);
      return;
    }
    await navigator.clipboard.writeText(`${text}\n\n${url}`);
    toast('Post text and link copied.');
  } catch (err) {
    if (err.name !== 'AbortError') toast(`Could not share: ${err.message}`);
  }
}

async function sharePostById(id) {
  const post = await pulse.getPost(id);
  if (!post) throw new Error('Post not found.');
  await sharePost(post);
}

function renderAttachmentItem(att) {
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
}

function renderAttachments(attachments) {
  if (!attachments || !attachments.length) return '';
  if (attachments.length === 1) return renderAttachmentItem(attachments[0]);

  const slides = attachments.map((att, index) => `
    <div class="attachment-slide${index === 0 ? ' is-active' : ''}">
      ${renderAttachmentItem(att)}
    </div>
  `).join('');

  const dots = attachments.map((att, index) => `
    <button type="button" class="attachment-dot${index === 0 ? ' is-active' : ''}" data-carousel-dot="${index}" aria-label="View attachment ${index + 1}"></button>
  `).join('');

  return `
    <div class="attachment-carousel" data-carousel>
      <div class="attachment-carousel-track" role="button" tabindex="0" aria-label="Maximize attachment carousel">
        ${slides}
      </div>
      <div class="attachment-carousel-controls">
        <button type="button" class="attachment-carousel-btn" data-carousel-prev aria-label="Previous attachment">◀</button>
        <div class="attachment-carousel-dots">${dots}</div>
        <button type="button" class="attachment-carousel-btn" data-carousel-next aria-label="Next attachment">▶</button>
      </div>
    </div>
  `;
}

function openCarouselModal(carousel) {
  const modal = document.getElementById('carousel-modal');
  const content = document.getElementById('carousel-modal-content');
  const activeIndex = [...carousel.querySelectorAll('.attachment-slide')]
    .findIndex((slide) => slide.classList.contains('is-active'));
  const maximizedCarousel = carousel.cloneNode(true);
  maximizedCarousel.removeAttribute('data-carousel-bound');
  maximizedCarousel.querySelector('.attachment-carousel-track')?.removeAttribute('tabindex');
  maximizedCarousel.querySelector('.attachment-carousel-track')?.removeAttribute('role');
  maximizedCarousel.querySelector('.attachment-carousel-track')?.removeAttribute('aria-label');
  maximizedCarousel.querySelectorAll('.attachment-slide').forEach((slide, index) => {
    slide.classList.toggle('is-active', index === activeIndex);
  });
  maximizedCarousel.querySelectorAll('[data-carousel-dot]').forEach((dot, index) => {
    dot.classList.toggle('is-active', index === activeIndex);
  });
  content.replaceChildren(maximizedCarousel);
  bindAttachmentCarousels(content);
  modal.showModal();
}

function bindAttachmentCarousels(root = document) {
  root.querySelectorAll('[data-carousel]').forEach((carousel) => {
    if (carousel.dataset.carouselBound) return; // avoid re-attaching listeners to carousels bound by a previous render
    carousel.dataset.carouselBound = '1';
    const slides = [...carousel.querySelectorAll('.attachment-slide')];
    const dots = [...carousel.querySelectorAll('[data-carousel-dot]')];
    const prevBtn = carousel.querySelector('[data-carousel-prev]');
    const nextBtn = carousel.querySelector('[data-carousel-next]');
    if (!slides.length) return;

    const update = (index) => {
      const total = slides.length;
      const activeIndex = (index + total) % total;
      slides.forEach((slide, idx) => slide.classList.toggle('is-active', idx === activeIndex));
      dots.forEach((dot, idx) => dot.classList.toggle('is-active', idx === activeIndex));
    };

    prevBtn?.addEventListener('click', () => update(slides.findIndex((slide) => slide.classList.contains('is-active')) - 1));
    nextBtn?.addEventListener('click', () => update(slides.findIndex((slide) => slide.classList.contains('is-active')) + 1));
    dots.forEach((dot) => {
      dot.addEventListener('click', () => update(Number(dot.dataset.carouselDot)));
    });

    const track = carousel.querySelector('.attachment-carousel-track');
    if (track?.hasAttribute('tabindex')) {
      track.addEventListener('click', (event) => {
        if (event.target.closest('a, button, audio, video')) return;
        openCarouselModal(carousel);
      });
      track.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openCarouselModal(carousel);
      });
    }

    if (carousel.closest('#carousel-modal-content')) {
      let touchStartX = 0;
      let touchStartY = 0;
      track?.addEventListener('touchstart', (event) => {
        touchStartX = event.changedTouches[0].clientX;
        touchStartY = event.changedTouches[0].clientY;
      }, { passive: true });
      track?.addEventListener('touchend', (event) => {
        const deltaX = event.changedTouches[0].clientX - touchStartX;
        const deltaY = event.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
        update(slides.findIndex((slide) => slide.classList.contains('is-active')) + (deltaX < 0 ? 1 : -1));
      }, { passive: true });
    }
  });
}

function postCardHtml(post) {
  const excerpt = post.body ? post.body : '';
  const tags = (post.tags || []).map((t) => `<button class="tag-chip" data-tag="${escapeHtml(t)}" type="button">#${escapeHtml(t)}</button>`).join('');
  const canEdit = Boolean(state.user) && (state.user.role === 'admin' || !post.authorId || state.user.id === post.authorId);
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
        <span class="author-line">${profileLinkHtml(post.authorId, post.authorAvatar, post.authorName, 'avatar-sm')} <span>by</span></span>
        <span>${timeAgo(post.createdAt)}</span>
        ${post.linkUrl ? `<a href="${escapeHtml(post.linkUrl)}" target="_blank" rel="noopener noreferrer">🔗 link</a>` : ''}
      </div>
      ${excerpt ? `<div class="post-excerpt">${excerpt}</div>` : ''}
      ${renderAttachments(post.attachments)}
      ${tags ? `<div class="post-tags">${tags}</div>` : ''}
      <div class="post-actions">
        <button data-open="${post.id}" type="button">💬 ${post.commentCount} comments</button>
        <button data-share-post="${post.id}" type="button">↗ Share</button>
        ${canEdit ? `<button data-edit-post="${post.id}" type="button">✎ Edit</button><button class="danger" data-delete-post="${post.id}" type="button">🗑 Delete</button>` : ''}
      </div>
    </div>
  </article>`;
}

async function loadFeed(reset) {
  const list = document.getElementById('feed-list');
  if (reset) { state.offset = 0; list.innerHTML = '<p class="muted">Loading posts…</p>'; }
  try {
    const posts = await pulse.listPosts({ sort: state.sort, tag: state.tag, query: state.query, limit: state.limit, offset: state.offset });
    state.feedLoaded = true;
    if (reset) list.innerHTML = '';
    if (!posts.length && reset) {
      list.innerHTML = '<p class="muted">No posts match yet. Be the first to submit one!</p>';
    } else {
      list.insertAdjacentHTML('beforeend', posts.map(postCardHtml).join(''));
    }
    document.getElementById('load-more-btn').hidden = posts.length < state.limit;
    state.offset += posts.length;
    bindFeedEvents();
    bindAttachmentCarousels();
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
    const edit = card.querySelector('[data-edit-post]');
    if (edit) edit.onclick = () => openEditPost(id);
    const share = card.querySelector('[data-share-post]');
    if (share) share.onclick = async () => {
      try { await sharePostById(id); }
      catch (err) { toast(`Could not share: ${err.message}`); }
    };
    card.querySelectorAll('.tag-chip[data-tag]').forEach((chip) => {
      chip.onclick = () => {
        state.tag = chip.dataset.tag; state.offset = 0;
        renderActiveFilter(); loadTags(); loadFeed(true);
      };
    });
  });
}

document.addEventListener('click', (e) => {
  const profileLink = e.target.closest('[data-profile]');
  if (!profileLink) return;
  e.preventDefault();
  openPublicProfile(profileLink.dataset.profile);
});

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

async function openEditPost(id) {
  try {
    const post = await pulse.getPost(id);
    if (!post) throw new Error('Post not found.');
    state.editingPostId = post.id;
    state.pendingAttachments = [...(post.attachments || [])];
    document.getElementById('post-form').reset();
    document.getElementById('post-modal-title').textContent = 'Edit post';
    document.getElementById('post-submit').textContent = 'Save changes';
    document.getElementById('post-modal-sub').textContent = post.authorId ? `Editing ${post.authorName}'s post.` : 'Editing an anonymous post.';
    document.getElementById('post-title').value = post.title;
    document.getElementById('post-link').value = post.linkUrl || '';
    document.getElementById('post-body').innerHTML = post.body || '';
    document.getElementById('post-tags').value = (post.tags || []).join(', ');
    document.getElementById('post-attachment-preview').innerHTML = '';
    renderAttachmentPreview(document.getElementById('post-attachment-preview'), state.pendingAttachments);
    document.getElementById('post-error').hidden = true;
    document.getElementById('post-modal').showModal();
  } catch (err) {
    toast(`Could not edit: ${err.message}`);
  }
}

document.getElementById('load-more-btn').addEventListener('click', () => loadFeed(false));

/* ---------------------------------------------------------------------- */
/* Post detail + comments                                                  */
/* ---------------------------------------------------------------------- */

function showFeedView() {
  document.getElementById('feed-view').hidden = false;
  document.getElementById('post-view').hidden = true;
  document.getElementById('profile-view').hidden = true;
  document.getElementById('admin-view').hidden = true;
  history.replaceState(null, '', feedUrl());
  if (!state.feedLoaded) loadFeed(true);
}

function showPostView() {
  document.getElementById('feed-view').hidden = true;
  document.getElementById('post-view').hidden = false;
  document.getElementById('profile-view').hidden = true;
  document.getElementById('admin-view').hidden = true;
}

function showProfileView() {
  if (!state.user) { openAuthModal('login'); return; }
  document.getElementById('feed-view').hidden = true;
  document.getElementById('post-view').hidden = true;
  document.getElementById('profile-view').hidden = false;
  document.getElementById('admin-view').hidden = true;
  renderProfileView();
}

function showPublicProfileView() {
  document.getElementById('feed-view').hidden = true;
  document.getElementById('post-view').hidden = true;
  document.getElementById('profile-view').hidden = false;
  document.getElementById('admin-view').hidden = true;
}

async function openPublicProfile(id, { updateUrl = true } = {}) {
  if (updateUrl) history.pushState(null, '', userUrl(id));
  const view = document.getElementById('profile-view');
  showPublicProfileView();
  view.innerHTML = '<p class="muted">Loading profile…</p>';
  try {
    let profile = await fetchProfile(id);
    if (!profile && state.user && state.user.id === id) {
      profile = await ensureProfileRow(id, state.user.username);
    }
    if (!profile) throw new Error('Profile not found.');
    const user = toUser(profile);
    const externalUrl = safeProfileUrl(user.profileUrl);
    view.innerHTML = `
      <button class="btn ghost profile-back" id="public-profile-back-btn" type="button">← Back to feed</button>
      <section class="profile-panel public-profile">
        <div class="profile-heading">
          ${avatarHtml(user.avatar, user.name, 'avatar-lg')}
          <div>
            <p class="eyebrow">Community profile</p>
            <h1>${escapeHtml(user.name)}</h1>
            <p class="muted profile-username">@${escapeHtml(user.username)}</p>
            ${user.status ? `<p class="profile-status">${escapeHtml(user.status)}</p>` : '<p class="muted">No status yet.</p>'}
          </div>
        </div>
        ${externalUrl ? `<p class="profile-url"><a href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(externalUrl)}</a></p>` : ''}
        ${state.user && state.user.id === user.id ? '<button class="btn primary" id="edit-own-profile-btn" type="button">Edit profile</button>' : ''}
      </section>`;
    document.getElementById('public-profile-back-btn').onclick = showFeedView;
    const editBtn = document.getElementById('edit-own-profile-btn');
    if (editBtn) editBtn.onclick = showProfileView;
  } catch (err) {
    view.innerHTML = `<p class="form-error">Could not load profile: ${escapeHtml(err.message)}</p>`;
  }
}

function renderProfileView() {
  const root = document.getElementById('profile-view');
  const user = state.user;
  root.innerHTML = `
    <button class="btn ghost profile-back" id="profile-back-btn" type="button">← Back to feed</button>
    <section class="profile-panel">
      <div class="profile-heading">
        ${avatarHtml(user.avatar, user.name, 'avatar-lg')}
        <div>
          <p class="eyebrow">About your profile</p>
          <h1>${escapeHtml(user.name)}</h1>
          <p class="muted profile-username">@${escapeHtml(user.username)}</p>
          <p class="muted">This information appears alongside your posts and comments.</p>
        </div>
      </div>
      <form id="profile-form" class="profile-form">
        <label>Username <span class="muted small">(3-32 letters, numbers, _ . -)</span>
          <input type="text" id="profile-username" value="${escapeHtml(user.username)}" required minlength="3" maxlength="32" autocomplete="username">
        </label>
        <label>Name
          <input type="text" id="profile-name" value="${escapeHtml(user.name === user.username ? '' : user.name)}" maxlength="80" autocomplete="name" placeholder="Optional">
        </label>
        <label>Status <span class="muted small">(160 characters maximum)</span>
          <textarea id="profile-status" maxlength="160" rows="3" placeholder="What are you working on?">${escapeHtml(user.status)}</textarea>
        </label>
        <label>URL
          <input type="url" id="profile-url" value="${escapeHtml(user.profileUrl)}" maxlength="2000" placeholder="https://example.com/you">
        </label>
        <label>Profile picture
          <input type="file" id="profile-avatar" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml">
          <span class="muted small">PNG, JPEG, GIF, WEBP, or SVG up to 256KB.</span>
        </label>
        <div class="profile-avatar-preview" id="profile-avatar-preview">${avatarHtml(user.avatar, user.username, 'avatar-lg')}</div>
        <button type="button" class="btn ghost profile-remove-avatar" id="profile-remove-avatar">Remove picture</button>
        <p class="form-error" id="profile-error" hidden></p>
        <footer>
          <button type="submit" class="btn primary" id="profile-save-btn">Save profile</button>
        </footer>
      </form>
    </section>`;

  let pendingAvatar = user.avatar || null;
  const preview = document.getElementById('profile-avatar-preview');
  const avatarInput = document.getElementById('profile-avatar');
  avatarInput.onchange = async () => {
    const file = avatarInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please choose an image file.'); avatarInput.value = ''; return; }
    if (file.size > 256 * 1024) { toast('Image must be smaller than 256KB.'); avatarInput.value = ''; return; }
    pendingAvatar = await readFileAsDataUrl(file);
    preview.innerHTML = avatarHtml(pendingAvatar, user.username, 'avatar-lg');
  };
  document.getElementById('profile-remove-avatar').onclick = () => {
    pendingAvatar = null;
    avatarInput.value = '';
    preview.innerHTML = avatarHtml(null, user.username, 'avatar-lg');
  };
  document.getElementById('profile-back-btn').onclick = showFeedView;
  document.getElementById('profile-form').onsubmit = async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('profile-error');
    const saveBtn = document.getElementById('profile-save-btn');
    errorEl.hidden = true;
    saveBtn.disabled = true;
    try {
      state.user = await pulse.updateProfile({
        username: document.getElementById('profile-username').value,
        name: document.getElementById('profile-name').value,
        status: document.getElementById('profile-status').value,
        profileUrl: document.getElementById('profile-url').value,
        avatar: pendingAvatar,
      });
      renderAuthNav();
      renderProfileView();
      toast('Profile updated.');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      saveBtn.disabled = false;
    }
  };
}

async function hasAdminAccess() {
  if (!state.user) return false;
  if (state.user.role === 'admin') return true;
  if (!await pulse.isAdmin()) return false;
  state.user.role = 'admin';
  renderAuthNav();
  return true;
}

async function showAdminView() {
  if (!await hasAdminAccess()) { toast('Admin access required.'); return; }
  document.getElementById('feed-view').hidden = true;
  document.getElementById('post-view').hidden = true;
  document.getElementById('profile-view').hidden = true;
  document.getElementById('admin-view').hidden = false;
  renderAdminView('overview');
}

function resetAdminAccess() {
  const adminView = document.getElementById('admin-view');
  adminView.hidden = true;
  adminView.innerHTML = '';
}

function shouldKeepAdminRender(authRevision) {
  return authRevision === state.authRevision && Boolean(state.user) && !document.getElementById('admin-view').hidden;
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
  const authRevision = state.authRevision;
  try {
    if (tab === 'overview') {
      const stats = await pulse.adminStats();
      if (!shouldKeepAdminRender(authRevision)) return;
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
      if (!shouldKeepAdminRender(authRevision)) return;
      content.innerHTML = `
        <table class="admin-table">
          <thead><tr><th></th><th>Username</th><th>Role</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            ${users.map((u) => `
              <tr data-id="${u.id}">
                <td><a class="profile-link" href="${userUrl(u.id)}" data-profile="${escapeHtml(u.id)}">${avatarHtml(u.avatar, u.username, 'avatar-sm')}</a></td>
                <td><a class="profile-link" href="${userUrl(u.id)}" data-profile="${escapeHtml(u.id)}"><span>${escapeHtml(u.username)}</span></a></td>
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
      const [posts, users] = await Promise.all([pulse.adminListPosts(), pulse.adminListUsers()]);
      if (!shouldKeepAdminRender(authRevision)) return;
      content.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Author</th><th>Owner</th><th>Score</th><th>Comments</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${posts.map((p) => `
              <tr data-id="${p.id}">
                <td><a href="${postUrl(p.id)}" data-open-admin-post="${p.id}">${escapeHtml(p.title)}</a></td>
                <td>${profileLinkHtml(p.authorId, null, p.authorName)}</td>
                <td>
                  <div style="display:flex; gap:8px; align-items:center; min-width: 220px;">
                    <select data-post-owner-select="${p.id}" aria-label="Change post owner for ${escapeHtml(p.title)}">
                      <option value="">Anonymous</option>
                      ${users.map((u) => `<option value="${u.id}" ${u.id === p.authorId ? 'selected' : ''}>${escapeHtml(u.username)}</option>`).join('')}
                    </select>
                    <button class="btn ghost small" data-admin-change-owner="${p.id}" type="button">Save</button>
                  </div>
                </td>
                <td>${p.score}</td>
                <td>${p.commentCount}</td>
                <td>${p.isDeleted ? '<span class="deleted-badge">deleted</span>' : 'active'}</td>
                <td>
                  <button class="btn ghost small" data-admin-delete="${p.id}" type="button">${p.isDeleted ? 'Delete permanently' : 'Delete'}</button>
                  ${p.isDeleted ? `<button class="btn ghost small" data-restore="${p.id}" type="button">Restore</button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      content.querySelectorAll('[data-open-admin-post]').forEach((link) => {
        link.onclick = (e) => { e.preventDefault(); openPost(link.dataset.openAdminPost); };
      });
      content.querySelectorAll('[data-admin-change-owner]').forEach((btn) => {
        btn.onclick = async () => {
          const select = content.querySelector(`[data-post-owner-select="${btn.dataset.adminChangeOwner}"]`);
          const ownerId = select ? select.value : '';
          const ownerName = select && select.selectedOptions[0] ? select.selectedOptions[0].textContent : '';
          try {
            await pulse.adminSetPostAuthor(btn.dataset.adminChangeOwner, ownerId || null, ownerName);
            toast('Post ownership updated.');
            renderAdminView('posts');
          } catch (err) {
            toast(`Could not update owner: ${err.message}`);
          }
        };
      });
      content.querySelectorAll('[data-admin-delete]').forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm('Delete this post? This will also remove its comments and votes.')) return;
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
    if (!shouldKeepAdminRender(authRevision)) return;
    content.innerHTML = `<p class="form-error">Failed to load: ${escapeHtml(err.message)}</p>`;
  }
}

function commentHtml(comment) {
  const canModerate = state.user && (state.user.role === 'admin' || state.user.id === comment.authorId);
  const body = comment.isDeleted ? '<em>[deleted]</em>' : comment.body;
  return `
  <div class="comment${comment.isDeleted ? ' is-deleted' : ''}" data-id="${comment.id}">
    <div class="comment-header">
      ${!comment.isDeleted ? profileLinkHtml(comment.authorId, comment.authorAvatar, comment.authorName, 'avatar-sm') : ''}
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
    const canEdit = Boolean(state.user) && (state.user.role === 'admin' || !post.authorId || state.user.id === post.authorId);
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
              <span class="author-line">${profileLinkHtml(post.authorId, post.authorAvatar, post.authorName, 'avatar-sm')} <span>by</span></span>
              <span>${timeAgo(post.createdAt)}</span>
              ${post.linkUrl ? `<a href="${escapeHtml(post.linkUrl)}" target="_blank" rel="noopener noreferrer">🔗 ${escapeHtml(post.linkUrl)}</a>` : ''}
            </div>
            ${post.body ? `<div class="post-excerpt">${post.body}</div>` : ''}
            ${renderAttachments(post.attachments)}
            <div class="post-tags">${(post.tags || []).map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>
            <div class="post-actions">
              <button id="share-post-detail" type="button">↗ Share</button>
              ${canEdit ? `<button id="edit-post-detail" type="button">✎ Edit post</button><button class="danger" id="delete-post-detail" type="button">🗑 Delete post</button>` : ''}
            </div>
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
    bindAttachmentCarousels();
    bindRichTextToolbars(view);
    bindPostDetailEvents(post, view);
  } catch (err) {
    view.innerHTML = `<p class="form-error">Could not load post: ${escapeHtml(err.message)}</p>`;
  }
}

function bindPostDetailEvents(post, root) {
  const postId = post.id;
  const detail = root.querySelector('.post-detail');
  detail.querySelectorAll('[data-vote]').forEach((btn) => {
    btn.onclick = () => castVote('post', postId, Number(btn.dataset.vote), detail);
  });
  const shareBtn = root.querySelector('#share-post-detail');
  if (shareBtn) shareBtn.onclick = () => sharePost(post);
  const delBtn = root.querySelector('#delete-post-detail');
  if (delBtn) delBtn.onclick = async () => { await deletePost(postId); showFeedView(); };
  const editBtn = root.querySelector('#edit-post-detail');
  if (editBtn) editBtn.onclick = () => openEditPost(postId);

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
      try {
        const nextFiles = Array.from(fileInput.files || []);
        if (attachments.length + nextFiles.length > MAX_POST_ATTACHMENTS) {
          throw new Error(`Please attach no more than ${MAX_POST_ATTACHMENTS} files per post.`);
        }
        for (const file of nextFiles) {
          const dataUrl = await readAttachmentDataUrl(file);
          attachments.push({ name: file.name, mimeType: file.type, size: file.size, dataUrl });
        }
        fileInput.value = '';
        renderAttachmentPreview(preview, attachments);
      } catch (err) {
        toast(err.message);
      }
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

async function readAttachmentDataUrl(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return readFileAsDataUrl(file);

  const fileSizeBytes = Number(file.size || 0);
  if (fileSizeBytes <= MAX_ATTACHMENT_BYTES) return readFileAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL(file.type.includes('png') ? 'image/png' : 'image/jpeg', 0.72);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image attachment.'));
    };
    img.src = objectUrl;
  });
}

function validateAttachments(attachments) {
  const safeAttachments = (attachments || []).filter(Boolean);
  if (safeAttachments.length > MAX_POST_ATTACHMENTS) {
    throw new Error(`Please attach no more than ${MAX_POST_ATTACHMENTS} files per post.`);
  }

  const totalBytes = safeAttachments.reduce((sum, att) => sum + (Number(att.size || 0) || Math.max(0, Math.round((String(att.dataUrl || '').length * 3) / 4))), 0);
  if (totalBytes > MAX_ATTACHMENT_TOTAL_BYTES) {
    throw new Error('Attached files are too large for a single post. Please use fewer or smaller images.');
  }

  return safeAttachments;
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
  state.editingPostId = null;
  state.pendingAttachments = [];
  document.getElementById('post-form').reset();
  document.getElementById('post-modal-title').textContent = 'Submit a post';
  document.getElementById('post-submit').textContent = 'Post';
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
  try {
    const files = Array.from(e.target.files || []);
    if (state.pendingAttachments.length + files.length > MAX_POST_ATTACHMENTS) {
      throw new Error(`Please attach no more than ${MAX_POST_ATTACHMENTS} files per post.`);
    }
    for (const file of files) {
      const dataUrl = await readAttachmentDataUrl(file);
      state.pendingAttachments.push({ name: file.name, mimeType: file.type, size: file.size, dataUrl });
    }
    e.target.value = '';
    renderAttachmentPreview(document.getElementById('post-attachment-preview'), state.pendingAttachments);
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('post-body').addEventListener('paste', async (e) => {
  const imageFiles = Array.from(e.clipboardData?.items || [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (!imageFiles.length) return;

  e.preventDefault();
  try {
    if (state.pendingAttachments.length + imageFiles.length > MAX_POST_ATTACHMENTS) {
      throw new Error(`Please attach no more than ${MAX_POST_ATTACHMENTS} files per post.`);
    }
    for (const file of imageFiles) {
      const dataUrl = await readAttachmentDataUrl(file);
      state.pendingAttachments.push({
        name: file.name || `pasted-image.${file.type.split('/')[1] || 'png'}`,
        mimeType: file.type,
        size: file.size,
        dataUrl,
      });
    }
    renderAttachmentPreview(document.getElementById('post-attachment-preview'), state.pendingAttachments);
    toast(`${imageFiles.length === 1 ? 'Image' : 'Images'} added to attachments.`);
  } catch (err) {
    toast(err.message);
  }
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
    const editing = Boolean(state.editingPostId);
    if (editing) await pulse.updatePost(state.editingPostId, { title, body, linkUrl, tags, attachments: state.pendingAttachments });
    else await pulse.createPost({ title, body, linkUrl, tags, attachments: state.pendingAttachments });
    document.getElementById('post-modal').close();
    state.editingPostId = null;
    toast(editing ? 'Post updated.' : 'Post submitted.');
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
  renderSearchResults([], []);
  renderActiveFilter();
  showFeedView();
  loadFeed(true);
});

document.getElementById('feed-refresh-btn').addEventListener('click', () => loadFeed(true));
document.getElementById('mobile-compose-btn').addEventListener('click', () => document.getElementById('submit-post-btn').click());
document.getElementById('mobile-home-btn').addEventListener('click', () => document.querySelector('.brand').click());
document.getElementById('mobile-search-btn').addEventListener('click', () => {
  document.getElementById('search-input').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.getElementById('mobile-tags-btn').addEventListener('click', () => {
  const tagsPanel = document.getElementById('tags-panel');
  tagsPanel.classList.add('mobile-topic-open');
  document.querySelectorAll('.mobile-tab').forEach((tab) => tab.classList.remove('is-active'));
  document.getElementById('mobile-tags-btn').classList.add('is-active');
  tagsPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
document.getElementById('mobile-profile-btn').addEventListener('click', () => {
  if (state.user) showProfileView();
  else openAuthModal('login');
});

window.addEventListener('popstate', () => {
  const postId = new URLSearchParams(window.location.search).get('post');
  const userId = new URLSearchParams(window.location.search).get('user');
  if (postId) {
    openPost(postId, { updateUrl: false });
  } else if (userId) {
    openPublicProfile(userId, { updateUrl: false });
  } else {
    showFeedView();
    loadFeed(true);
  }
});

(async function init() {
  await refreshMe();
  loadTags();
  const postId = new URLSearchParams(window.location.search).get('post');
  const userId = new URLSearchParams(window.location.search).get('user');
  if (postId) openPost(postId, { updateUrl: false });
  else if (userId) openPublicProfile(userId, { updateUrl: false });
  else loadFeed(true);
})();
