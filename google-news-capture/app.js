const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
const RSS2JSON_PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';
const GOOGLE_NEWS_FEEDS = [
  { section: 'Top Stories', url: GOOGLE_NEWS_RSS_URL },
  ...['WORLD', 'NATION', 'BUSINESS', 'TECHNOLOGY', 'ENTERTAINMENT', 'SPORTS', 'SCIENCE', 'HEALTH'].map((topic) => ({
    section: topic.charAt(0) + topic.slice(1).toLowerCase(),
    url: `https://news.google.com/rss/headlines/section/topic/${topic}?hl=en-US&gl=US&ceid=US:en`,
  })),
];

const elements = {
  captureButton: document.getElementById('capture-button'),
  buttonLabel: document.querySelector('#capture-button .button-label'),
  searchInput: document.getElementById('article-search'),
  statusPanel: document.getElementById('status-panel'),
  statusTitle: document.getElementById('status-title'),
  statusMessage: document.getElementById('status-message'),
  statusMeta: document.getElementById('status-meta'),
  statusIcon: document.getElementById('status-icon'),
  storyList: document.getElementById('story-list'),
  emptyNote: document.getElementById('empty-note'),
  errorMessage: document.getElementById('error-message'),
  downloadButton: document.getElementById('download-button'),
  captureFooter: document.getElementById('capture-footer'),
};

let capturedItems = [];

function getVisibleStories() {
  const query = elements.searchInput.value.trim().toLowerCase();

  if (!query) {
    return capturedItems;
  }

  return capturedItems.filter((story) => {
    const haystack = [
      story.header_title,
      story.section,
      ...(story.subtitles || []).map((subtitle) => subtitle.title),
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  });
}

function updateSearchResults() {
  const visibleStories = getVisibleStories();

  if (!visibleStories.length) {
    elements.storyList.innerHTML = '';
    elements.emptyNote.hidden = false;
    elements.emptyNote.innerHTML = elements.searchInput.value.trim()
      ? '<span class="empty-star" aria-hidden="true">✳</span><span>No matching articles found.<br>Try a different keyword or topic.</span>'
      : '<span class="empty-star" aria-hidden="true">✳</span><span>Nothing in your briefing yet.<br>Start a capture to bring today’s stories into focus.</span>';
    elements.downloadButton.hidden = !capturedItems.length;
    elements.captureFooter.hidden = true;
    return;
  }

  elements.storyList.replaceChildren(...visibleStories.map(createStoryCard));
  elements.emptyNote.hidden = true;
  elements.downloadButton.hidden = false;
  elements.captureFooter.hidden = false;
}

function createStoryCard(story, index) {
  const card = document.createElement('article');
  card.className = 'story-card';

  const header = document.createElement('div');
  header.className = 'story-card-header';

  const number = document.createElement('span');
  number.className = 'story-number';
  number.textContent = String(index + 1).padStart(2, '0');

  const title = document.createElement('a');
  title.className = 'story-title';
  title.href = story.header_url;
  title.target = '_blank';
  title.rel = 'noopener noreferrer';
  title.textContent = story.header_title;

  header.append(number, title);
  card.append(header);

  if (story.section) {
    const section = document.createElement('span');
    section.className = 'story-section';
    section.textContent = story.section;
    card.append(section);
  }

  if (story.subtitles && story.subtitles.length) {
    const label = document.createElement('span');
    label.className = 'related-count';
    const count = story.subtitles.length;
    label.textContent = `${count} related ${count === 1 ? 'read' : 'reads'}`;

    const links = document.createElement('ul');
    links.className = 'related-links';

    for (const item of story.subtitles) {
      const row = document.createElement('li');
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.title;
      row.append(link);
      links.append(row);
    }

    card.append(label, links);
  }

  return card;
}

function renderStories(items) {
  const filteredItems = getVisibleStories();

  if (elements.searchInput.value.trim() && filteredItems.length !== items.length) {
    updateSearchResults();
    return;
  }

  const visibleItems = elements.searchInput.value.trim() ? filteredItems : items;

  if (!visibleItems.length) {
    elements.storyList.innerHTML = '';
    elements.emptyNote.hidden = false;
    elements.emptyNote.innerHTML = '<span class="empty-star" aria-hidden="true">✳</span><span>Nothing in your briefing yet.<br>Start a capture to bring today’s stories into focus.</span>';
    elements.downloadButton.hidden = true;
    elements.captureFooter.hidden = true;
    return;
  }

  elements.storyList.replaceChildren(...visibleItems.map(createStoryCard));
  elements.emptyNote.hidden = true;
  elements.downloadButton.hidden = false;
  elements.captureFooter.hidden = false;
}

function setStatus(state, title, message, meta) {
  elements.statusPanel.dataset.state = state;
  elements.statusTitle.textContent = title;
  elements.statusMessage.textContent = message;
  elements.statusMeta.textContent = meta;
  elements.statusIcon.textContent = state === 'running' ? '◌' : state === 'error' ? '!' : '✳';
}

function showError(message) {
  elements.errorMessage.hidden = false;
  elements.errorMessage.textContent = message;
}

function clearError() {
  elements.errorMessage.hidden = true;
  elements.errorMessage.textContent = '';
}

function normalizeStories(items) {
  const seenLinks = new Set();

  return items.reduce((stories, item) => {
    if (!item || !item.title || !item.link || seenLinks.has(item.link)) {
      return stories;
    }

    seenLinks.add(item.link);
    stories.push({
      header_title: item.title.replace(/\s+/g, ' ').trim(),
      header_url: item.link,
      section: item.section || 'Google News',
      subtitles: (item.categories || []).filter(Boolean).slice(0, 4).map((subtitle) => ({
        title: String(subtitle).replace(/\s+/g, ' ').trim(),
        url: item.link,
      })),
    });
    return stories;
  }, []);
}

async function fetchNewsFeed(feed) {
  const response = await fetch(`${RSS2JSON_PROXY}${encodeURIComponent(feed.url)}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`${feed.section} feed request failed (${response.status}).`);
  }

  const payload = await response.json();
  if (payload.status !== 'ok') {
    throw new Error(payload.message || `${feed.section} feed is unavailable.`);
  }

  return (payload.items || []).map((item) => ({ ...item, section: feed.section }));
}

async function fetchGoogleNews() {
  clearError();
  setStatus('running', 'Building your briefing', 'Loading Top Stories and all available news sections…', 'IN PROGRESS');
  elements.captureButton.disabled = true;
  elements.buttonLabel.textContent = 'Gathering the latest stories…';

  try {
    const feedResults = await Promise.allSettled(GOOGLE_NEWS_FEEDS.map(fetchNewsFeed));
    const successfulFeeds = feedResults.filter((result) => result.status === 'fulfilled');
    const allFeedItems = successfulFeeds.flatMap((result) => result.value);

    if (!allFeedItems.length) {
      const failure = feedResults.find((result) => result.status === 'rejected');
      throw failure?.reason || new Error('No stories were returned by the Google News feeds.');
    }

    capturedItems = normalizeStories(allFeedItems);
    renderStories(capturedItems);
    const feedMessage = successfulFeeds.length === GOOGLE_NEWS_FEEDS.length
      ? `Loaded ${capturedItems.length} unique stories across ${successfulFeeds.length} Google News feeds.`
      : `Loaded ${capturedItems.length} unique stories across ${successfulFeeds.length} of ${GOOGLE_NEWS_FEEDS.length} feeds.`;
    setStatus('idle', `${capturedItems.length} ${capturedItems.length === 1 ? 'story' : 'stories'} in your briefing`, feedMessage, `${successfulFeeds.length} FEEDS`);
    if (successfulFeeds.length < GOOGLE_NEWS_FEEDS.length) {
      showError(`${GOOGLE_NEWS_FEEDS.length - successfulFeeds.length} Google News section feed(s) could not be loaded.`);
    }
    elements.captureFooter.textContent = `Captured ${new Date().toLocaleString()} · Source: Google News`;
    elements.captureFooter.hidden = false;
    elements.captureButton.disabled = false;
    elements.buttonLabel.textContent = 'Capture today’s headlines';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showError(message);
    renderStories([]);
    setStatus('error', 'Capture needs attention', 'The news feed is temporarily unavailable. Please try again.', 'CAPTURE FAILED');
    elements.captureButton.disabled = false;
    elements.buttonLabel.textContent = 'Capture today’s headlines';
  }
}

function downloadAsJson() {
  const payload = {
    source_feeds: GOOGLE_NEWS_FEEDS.map(({ section, url }) => ({ section, url })),
    captured_at_utc: new Date().toISOString(),
    news: capturedItems,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'google_news_capture.json';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  elements.captureButton.addEventListener('click', fetchGoogleNews);
  elements.downloadButton.addEventListener('click', downloadAsJson);
  elements.searchInput.addEventListener('input', updateSearchResults);
}

bindEvents();
renderStories([]);
setStatus('idle', 'Ready when you are', 'Your captured headlines will appear here.', 'NO CAPTURE YET');
