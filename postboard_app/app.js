const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const state = {
  posts: [],
  search: '',
  pendingAttachment: null,
};

const elements = {
  form: document.getElementById('postForm'),
  list: document.getElementById('postList'),
  search: document.getElementById('searchInput'),
  count: document.getElementById('postCount'),
  deleteAll: document.getElementById('deleteAllBtn'),
  export: document.getElementById('exportBtn'),
  import: document.getElementById('importInput'),
  cancelEdit: document.getElementById('cancelEditBtn'),
  editingId: document.getElementById('editingPostId'),
  submit: document.getElementById('submitButton'),
  eyebrow: document.getElementById('composerEyebrow'),
  title: document.getElementById('composerTitle'),
  attachment: document.getElementById('attachment'),
  attachmentName: document.getElementById('attachmentName'),
  status: document.getElementById('formStatus'),
};

async function loadPosts() {
  const response = await fetch('/api/posts');
  if (!response.ok) {
    throw new Error(await getApiError(response, 'Could not load posts from the SQLite database.'));
  }
  return response.json();
}

async function getApiError(response, fallback) {
  try {
    const body = await response.json();
    return body.error || `${fallback} (HTTP ${response.status}).`;
  } catch (error) {
    return `${fallback} (HTTP ${response.status}). Start server.py and open http://127.0.0.1:8000.`;
  }
}

async function savePosts() {
  const response = await fetch('/api/posts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state.posts),
  });
  if (!response.ok) {
    throw new Error(await getApiError(response, 'Could not save posts to the SQLite database.'));
  }
}

function isPost(value) {
  return value && typeof value === 'object' && typeof value.id === 'string'
    && typeof value.personName === 'string' && typeof value.userName === 'string'
    && typeof value.message === 'string' && typeof value.date === 'string'
    && typeof value.time === 'string';
}

function exportPosts() {
  const json = JSON.stringify(state.posts, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `postboard-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importPosts(event) {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported) || !imported.every(isPost)) {
      throw new Error('This file does not contain a valid Postboard JSON archive.');
    }
    const replace = window.confirm('Replace current posts with this JSON archive? Choose Cancel to merge them.');
    state.posts = replace ? imported : [...imported, ...state.posts.filter((post) => !imported.some((item) => item.id === post.id))];
    await savePosts();
    render();
    setStatus(`${imported.length} post${imported.length === 1 ? '' : 's'} imported.`, 'success');
  } catch (error) {
    setStatus(error.message || 'Could not import that JSON file.', 'error');
  } finally {
    event.target.value = '';
  }
}

function makeId() {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function escapeHtml(value) {
  const element = document.createElement('div');
  element.textContent = value ?? '';
  return element.innerHTML;
}

function formatDate(post) {
  const date = new Date(`${post.date}T${post.time || '00:00'}`);
  if (Number.isNaN(date.getTime())) return `${post.date} ${post.time || ''}`;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function getInitials(name) {
  return name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'P';
}

function setStatus(message, kind = '') {
  elements.status.textContent = message;
  elements.status.className = `form-status ${kind}`;
}

function resetComposer() {
  elements.form.reset();
  elements.editingId.value = '';
  elements.attachmentName.textContent = 'JPG, PNG, PDF, or any small file';
  elements.cancelEdit.classList.add('hidden');
  elements.eyebrow.textContent = 'New entry';
  elements.title.textContent = 'What happened?';
  elements.submit.innerHTML = 'Publish post <span>-></span>';
  state.pendingAttachment = null;
  setDefaultDateTime();
}

function setDefaultDateTime() {
  const now = new Date();
  document.getElementById('postDate').value = now.toISOString().slice(0, 10);
  document.getElementById('postTime').value = now.toTimeString().slice(0, 5);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: reader.result });
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

function attachmentMarkup(attachment) {
  if (!attachment) return '';
  const image = attachment.type.startsWith('image/');
  return `<div class="attachment-preview">${image ? `<img src="${attachment.data}" alt="${escapeHtml(attachment.name)}" />` : '<span class="file-badge">FILE</span>'}<span>${escapeHtml(attachment.name)}</span></div>`;
}

function render() {
  const query = state.search.toLowerCase();
  const posts = state.posts.filter((post) => [post.message, post.personName, post.userName, post.location, post.attachment?.name].join(' ').toLowerCase().includes(query));
  elements.count.textContent = `${state.posts.length} ${state.posts.length === 1 ? 'post' : 'posts'}`;

  if (posts.length === 0) {
    elements.list.innerHTML = state.posts.length === 0
      ? '<div class="empty-state"><span class="empty-mark">P/</span><h3>Your archive starts here.</h3><p>Publish your first post and it will appear in this timeline.</p></div>'
      : '<div class="empty-state"><span class="empty-mark">?</span><h3>No matching posts.</h3><p>Try a different name, place, or phrase.</p></div>';
    return;
  }

  elements.list.innerHTML = posts.map((post) => `
    <article class="post-card" data-post-id="${post.id}">
      <div class="post-card-top">
        <div class="avatar">${escapeHtml(getInitials(post.personName))}</div>
        <div class="author"><strong>${escapeHtml(post.personName)}</strong><span>${escapeHtml(post.userName)}</span></div>
        <time datetime="${escapeHtml(`${post.date}T${post.time}`)}">${escapeHtml(formatDate(post))}</time>
      </div>
      <p class="post-message">${escapeHtml(post.message).replace(/\n/g, '<br />')}</p>
      <div class="post-footer">
        <div class="post-details">${post.location ? `<span class="detail location">@ ${escapeHtml(post.location)}</span>` : ''}${attachmentMarkup(post.attachment)}</div>
        <div class="post-actions"><button class="icon-button" data-action="edit" type="button">Edit</button><button class="icon-button danger-text" data-action="delete" type="button">Delete</button></div>
      </div>
    </article>
  `).join('');
}

function beginEdit(post) {
  document.getElementById('personName').value = post.personName;
  document.getElementById('userName').value = post.userName;
  document.getElementById('message').value = post.message;
  document.getElementById('postDate').value = post.date;
  document.getElementById('postTime').value = post.time;
  document.getElementById('location').value = post.location || '';
  elements.editingId.value = post.id;
  elements.attachmentName.textContent = post.attachment?.name || 'Keep current attachment or choose a new file';
  state.pendingAttachment = post.attachment || null;
  elements.cancelEdit.classList.remove('hidden');
  elements.eyebrow.textContent = 'Editing entry';
  elements.title.textContent = 'Make it right.';
  elements.submit.innerHTML = 'Save changes <span>-></span>';
  document.querySelector('.composer-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const post = {
    personName: formData.get('personName').toString().trim(),
    userName: formData.get('userName').toString().trim(),
    message: formData.get('message').toString().trim(),
    date: formData.get('postDate').toString(),
    time: formData.get('postTime').toString(),
    location: formData.get('location').toString().trim(),
  };

  if (!post.personName || !post.userName || !post.message) return;
  const file = elements.attachment.files[0];
  if (file && file.size > MAX_ATTACHMENT_BYTES) {
    setStatus('Please choose a file smaller than 4 MB.', 'error');
    return;
  }

  elements.submit.disabled = true;
  try {
    if (file) state.pendingAttachment = await readFile(file);
    post.attachment = state.pendingAttachment;
    const editingId = elements.editingId.value;
    if (editingId) {
      state.posts = state.posts.map((item) => item.id === editingId ? { ...item, ...post, updatedAt: new Date().toISOString() } : item);
      setStatus('Post updated in SQLite.', 'success');
    } else {
      state.posts.unshift({ ...post, id: makeId(), createdAt: new Date().toISOString() });
      setStatus('Post published to SQLite.', 'success');
    }
    await savePosts();
    render();
    window.setTimeout(resetComposer, 700);
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    elements.submit.disabled = false;
  }
}

elements.form.addEventListener('submit', handleSubmit);
elements.search.addEventListener('input', (event) => { state.search = event.target.value.trim(); render(); });
elements.export.addEventListener('click', exportPosts);
elements.import.addEventListener('change', importPosts);
elements.attachment.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) elements.attachmentName.textContent = `${file.name} (${Math.ceil(file.size / 1024)} KB)`;
});
elements.cancelEdit.addEventListener('click', resetComposer);
elements.deleteAll.addEventListener('click', async () => {
  if (state.posts.length && window.confirm('Delete every saved post? This cannot be undone.')) {
    state.posts = [];
    await savePosts();
    resetComposer();
    render();
  }
});
elements.list.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const card = button.closest('[data-post-id]');
  const post = state.posts.find((item) => item.id === card.dataset.postId);
  if (!post) return;
  if (button.dataset.action === 'edit') beginEdit(post);
  if (button.dataset.action === 'delete' && window.confirm('Delete this post?')) {
    state.posts = state.posts.filter((item) => item.id !== post.id);
    await savePosts();
    render();
  }
});

async function init() {
  try {
    state.posts = await loadPosts();
    setDefaultDateTime();
    render();
  } catch (error) {
    setStatus('SQLite is unavailable. Start server.py and open http://127.0.0.1:8000.', 'error');
  }
}

init();
