const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
const RSS2JSON_PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';

const elements = {
  button: document.getElementById('capture-button'),
  downloadButton: document.getElementById('download-button'),
  statusPanel: document.getElementById('status-panel'),
  statusIcon: document.getElementById('status-icon'),
  statusTitle: document.getElementById('status-title'),
  statusMessage: document.getElementById('status-message'),
  statusMeta: document.getElementById('status-meta'),
  errorMessage: document.getElementById('error-message'),
  storyList: document.getElementById('story-list'),
  emptyNote: document.getElementById('empty-note'),
};

let capturedItems = [];

function setStatus(state, title, message, meta) {
  elements.statusPanel.dataset.state = state;
  elements.statusTitle.textContent = title;
  elements.statusMessage.textContent = message;
  elements.statusMeta.textContent = meta;
}

function showError(message) {
  elements.errorMessage.hidden = false;
  elements.errorMessage.textContent = message;
}

function clearError() {
  elements.errorMessage.hidden = true;
  elements.errorMessage.textContent = '';
}

function renderStories(items) {
  elements.storyList.innerHTML = '';

  if (!items.length) {
    elements.emptyNote.hidden = false;
    elements.downloadButton.hidden = true;
    return;
  }

  elements.emptyNote.hidden = true;
  elements.downloadButton.hidden = false;

  items.forEach((story) => {
    const card = document.createElement('article');
    card.className = 'story-item';

    const link = document.createElement('a');
    link.href = story.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const heading = document.createElement('h3');
    heading.textContent = story.title;

    const source = document.createElement('small');
    source.textContent = story.source || 'Google News';

    link.appendChild(heading);
    card.appendChild(link);
    card.appendChild(source);
    elements.storyList.appendChild(card);
  });
}

function normalizeStories(items) {
  return items
    .filter((item) => item && item.title && item.link)
    .map((item) => ({
      title: item.title.replace(/\s+/g, ' ').trim(),
      url: item.link,
      source: (item.author || item.source || 'Google News').replace(/\s+/g, ' ').trim(),
    }))
    .slice(0, 12);
}

async function fetchGoogleNews() {
  setStatus('loading', 'Loading headlines', 'Fetching the latest Google News stories…', 'LIVE');
  clearError();

  try {
    const response = await fetch(`${RSS2JSON_PROXY}${encodeURIComponent(GOOGLE_NEWS_RSS_URL)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`News feed request failed (${response.status}).`);
    }

    const payload = await response.json();

    if (payload.status !== 'ok') {
      throw new Error(payload.message || 'The news feed is temporarily unavailable.');
    }

    if (!Array.isArray(payload.items) || !payload.items.length) {
      throw new Error('No headlines were returned by the feed.');
    }

    capturedItems = normalizeStories(payload.items);
    renderStories(capturedItems);
    setStatus('ready', 'Headlines ready', `${capturedItems.length} stories loaded from Google News.`, 'CAPTURED');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showError(message);
    renderStories([]);
    setStatus('error', 'Could not load headlines', 'The news feed is temporarily unavailable. Please try again.', 'ERROR');
  }
}

function downloadAsJson() {
  const payload = {
    source_url: GOOGLE_NEWS_RSS_URL,
    captured_at_utc: new Date().toISOString(),
    news: capturedItems,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'google_news_capture.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  elements.button.addEventListener('click', fetchGoogleNews);
  elements.downloadButton.addEventListener('click', downloadAsJson);
}

bindEvents();
renderStories([]);
