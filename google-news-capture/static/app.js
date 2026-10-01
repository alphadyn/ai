const elements = {
  captureButton: document.querySelector('#capture-button'),
  buttonLabel: document.querySelector('#capture-button .button-label'),
  statusPanel: document.querySelector('#status-panel'),
  statusTitle: document.querySelector('#status-title'),
  statusMessage: document.querySelector('#status-message'),
  statusMeta: document.querySelector('#status-meta'),
  statusIcon: document.querySelector('#status-icon'),
  storyList: document.querySelector('#story-list'),
  emptyNote: document.querySelector('#empty-note'),
  errorMessage: document.querySelector('#error-message'),
  downloadButton: document.querySelector('#download-button'),
  captureFooter: document.querySelector('#capture-footer'),
};

let pollTimer;
const RUNNING_MESSAGE = 'Launching Chromium and loading the Google News feed…';

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

  if (story.subtitles?.length) {
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

function renderState(data) {
  const state = data.status || 'idle';
  const stories = Array.isArray(data.news) ? data.news : [];
  const isRunning = state === 'running';
  const isComplete = state === 'complete';
  const isError = state === 'error';

  elements.statusPanel.dataset.state = state;
  elements.statusMessage.textContent = data.message || 'Your captured headlines will appear here.';
  elements.errorMessage.textContent = data.error || '';
  elements.errorMessage.hidden = !data.error;
  elements.captureButton.disabled = isRunning;
  elements.buttonLabel.textContent = isRunning ? 'Gathering the latest stories…' : 'Capture today’s headlines';
  elements.statusIcon.textContent = isRunning ? '◌' : isError ? '!' : '✳';
  elements.statusTitle.textContent = isComplete
    ? `${stories.length} ${stories.length === 1 ? 'story' : 'stories'} in your briefing`
    : isRunning ? 'Building your briefing' : isError ? 'Capture needs attention' : 'Ready when you are';
  elements.statusMeta.textContent = isComplete ? 'CAPTURE COMPLETE' : isRunning ? 'IN PROGRESS' : isError ? 'CAPTURE FAILED' : 'NO CAPTURE YET';

  elements.storyList.replaceChildren(...stories.map(createStoryCard));
  elements.emptyNote.hidden = state !== 'idle';
  elements.downloadButton.hidden = !isComplete;
  elements.captureFooter.hidden = !isComplete;

  if (isComplete) {
    const capturedAt = data.captured_at_utc ? new Date(data.captured_at_utc) : new Date();
    elements.captureFooter.textContent = `Captured ${capturedAt.toLocaleString()} · Source: Google News`;
  }
}

async function fetchStatus() {
  const response = await fetch('/api/status');
  if (!response.ok) throw new Error('Could not check capture status.');
  return response.json();
}

async function pollStatus() {
  try {
    const data = await fetchStatus();
    renderState(data);
    if (data.status === 'running') pollTimer = window.setTimeout(pollStatus, 1800);
  } catch {
    // A brief local connection hiccup should not end an active capture.
    pollTimer = window.setTimeout(pollStatus, 3000);
  }
}

elements.captureButton.addEventListener('click', async () => {
  window.clearTimeout(pollTimer);
  try {
    const response = await fetch('/api/capture', { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not start the capture.');
    renderState({ status: 'running', message: RUNNING_MESSAGE, news: [] });
    pollTimer = window.setTimeout(pollStatus, 700);
  } catch (error) {
    renderState({
      status: 'error',
      message: 'The capture could not be started.',
      error: error instanceof Error ? error.message : String(error),
      news: [],
    });
  }
});

pollStatus();
