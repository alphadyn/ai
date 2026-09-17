'use strict';

/* Pulse — social news aggregator frontend (vanilla JS, no build step). */

const api = (() => {
  function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('pulse_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    headers['X-Anon-Id'] = anonId();
    return headers;
  }

  async function request(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: authHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* empty body */ }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body ?? {}),
    del: (path) => request('DELETE', path),
  };
})();

function anonId() {
  let id = localStorage.getItem('pulse_anon_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `anon-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('pulse_anon_id', id);
  }
  return id;
}

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
    const { user } = await api.get('/api/me');
    state.user = user;
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
      await api.del('/api/me/avatar');
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
      await api.post('/api/me/avatar', { avatarDataUrl: pendingDataUrl });
      state.user.avatar = pendingDataUrl;
      renderAuthNav();
      modal.close();
      toast('Profile picture updated.');
    } catch (err) { errorEl.textContent = err.message; errorEl.hidden = false; }
  };

  modal.showModal();
}

async function logout() {
  try { await api.post('/api/logout'); } catch (_) { /* ignore */ }
  localStorage.removeItem('pulse_token');
  state.user = null;
  renderAuthNav();
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
    const path = state.authMode === 'login' ? '/api/login' : '/api/register';
    const { user, token } = await api.post(path, { username, password });
    localStorage.setItem('pulse_token', token);
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
    const { tags } = await api.get('/api/tags');
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
      <h3 class="post-title"><a href="#" data-open="${post.id}">${escapeHtml(post.title)}</a></h3>
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
  const params = new URLSearchParams({ sort: state.sort, limit: state.limit, offset: state.offset });
  if (state.tag) params.set('tag', state.tag);
  if (state.query) params.set('q', state.query);
  try {
    const { posts } = await api.get(`/api/posts?${params.toString()}`);
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
    const path = kind === 'post' ? `/api/posts/${id}/vote` : `/api/comments/${id}/vote`;
    const { post, comment } = await api.post(path, { value: finalValue });
    const item = post || comment;
    const scoreEl = cardEl.querySelector('.vote-score, .comment-score');
    if (scoreEl) scoreEl.textContent = item.score;
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
    await api.del(`/api/posts/${id}`);
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
  history.replaceState(null, '', '#/');
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
      const { stats } = await api.get('/api/admin/stats');
      content.innerHTML = `
        <div class="admin-stats-grid">
          <div class="admin-stat-card"><div class="value">${stats.users}</div><div class="label">Registered users</div></div>
          <div class="admin-stat-card"><div class="value">${stats.posts}</div><div class="label">Active posts</div></div>
          <div class="admin-stat-card"><div class="value">${stats.anonymousPosts}</div><div class="label">Anonymous posts</div></div>
          <div class="admin-stat-card"><div class="value">${stats.comments}</div><div class="label">Active comments</div></div>
          <div class="admin-stat-card"><div class="value">${stats.deletedPosts}</div><div class="label">Deleted posts</div></div>
        </div>`;
    } else if (tab === 'users') {
      const { users } = await api.get('/api/admin/users');
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
            await api.post(`/api/admin/users/${btn.dataset.toggleRole}/role`, { role: btn.dataset.role });
            toast('Role updated.');
            renderAdminView('users');
          } catch (err) { toast(`Could not update role: ${err.message}`); }
        };
      });
    } else if (tab === 'posts') {
      const { posts } = await api.get('/api/admin/posts');
      content.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Author</th><th>Score</th><th>Comments</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${posts.map((p) => `
              <tr data-id="${p.id}">
                <td><a href="#" data-open-admin-post="${p.id}">${escapeHtml(p.title)}</a></td>
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
          try { await api.del(`/api/posts/${btn.dataset.adminDelete}`); toast('Post deleted.'); renderAdminView('posts'); }
          catch (err) { toast(`Could not delete: ${err.message}`); }
        };
      });
      content.querySelectorAll('[data-restore]').forEach((btn) => {
        btn.onclick = async () => {
          try { await api.post(`/api/posts/${btn.dataset.restore}/restore`); toast('Post restored.'); renderAdminView('posts'); }
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

async function openPost(id) {
  const view = document.getElementById('post-view');
  view.innerHTML = '<p class="muted">Loading…</p>';
  showPostView();
  try {
    const { post } = await api.get(`/api/posts/${id}`);
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
          await api.del(`/api/comments/${commentId}`);
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
      await api.post(`/api/posts/${postId}/comments`, { parentId, body, attachments });
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
    await api.post('/api/posts', { title, body, linkUrl, tags, attachments: state.pendingAttachments });
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

(async function init() {
  await refreshMe();
  loadTags();
  loadFeed(true);
})();
