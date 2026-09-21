(function () {
  'use strict';

  const state = { excluded: new Set(), lastPayload: null, analyzing: false };
  const elements = {
    form: document.getElementById('analysisForm'),
    urlCount: document.getElementById('urlCount'),
    topCount: document.getElementById('topCount'),
    urlList: document.getElementById('urlList'),
    urlTemplate: document.getElementById('urlFieldTemplate'),
    randomUrlButton: document.getElementById('randomUrlButton'),
    analyzeButton: document.getElementById('analyzeButton'),
    resultsSubtitle: document.getElementById('resultsSubtitle'),
    summary: document.getElementById('summary'),
    pageTotal: document.getElementById('pageTotal'),
    wordTotal: document.getElementById('wordTotal'),
    uniqueTotal: document.getElementById('uniqueTotal'),
    excludedPanel: document.getElementById('excludedPanel'),
    excludedList: document.getElementById('excludedList'),
    emptyState: document.getElementById('emptyState'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    wordList: document.getElementById('wordList'),
    sourceReport: document.getElementById('sourceReport'),
    sourceToggle: document.getElementById('sourceToggle'),
    sourceList: document.getElementById('sourceList'),
  };

  function clampNumber(input, fallback, min, max) {
    const value = Number.parseInt(input.value, 10);
    const clamped = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    input.value = clamped;
    return clamped;
  }

  function renderUrlFields() {
    const count = clampNumber(elements.urlCount, 3, 1, 20);
    const previousValues = Array.from(elements.urlList.querySelectorAll('input'), input => input.value);
    elements.urlList.replaceChildren();
    for (let index = 0; index < count; index += 1) {
      const field = elements.urlTemplate.content.firstElementChild.cloneNode(true);
      const input = field.querySelector('input');
      field.querySelector('.url-index').textContent = String(index + 1).padStart(2, '0');
      input.value = previousValues[index] || '';
      input.setAttribute('aria-label', `Web URL ${index + 1}`);
      field.querySelector('.clear-url').addEventListener('click', () => {
        input.value = '';
        input.focus();
      });
      elements.urlList.appendChild(field);
    }
  }

  function currentPayload() {
    return {
      urls: Array.from(elements.urlList.querySelectorAll('input'), input => input.value.trim()),
      top_count: clampNumber(elements.topCount, 20, 1, 100),
      excluded_words: Array.from(state.excluded),
    };
  }

  async function fillRandomUrls() {
    const count = clampNumber(elements.urlCount, 3, 1, 20);
    elements.randomUrlButton.disabled = true;
    elements.randomUrlButton.textContent = 'Finding URLs...';
    try {
      const response = await fetch(`/api/random-urls?count=${count}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Random URLs could not be found.');
      renderUrlFields();
      const inputs = elements.urlList.querySelectorAll('input');
      data.urls.forEach((url, index) => { inputs[index].value = url; });
      elements.resultsSubtitle.textContent = `${data.urls.length} working URLs added. Ready to analyze.`;
    } catch (error) {
      elements.errorState.textContent = error.message;
      elements.resultsSubtitle.textContent = 'Could not find random URLs.';
      setView('error');
    } finally {
      elements.randomUrlButton.disabled = false;
      elements.randomUrlButton.textContent = 'Fill random URLs';
    }
  }

  function setView(name) {
    elements.emptyState.hidden = name !== 'empty';
    elements.loadingState.hidden = name !== 'loading';
    elements.errorState.hidden = name !== 'error';
    elements.wordList.hidden = name !== 'results';
  }

  function renderExcluded() {
    elements.excludedPanel.hidden = state.excluded.size === 0;
    elements.excludedList.replaceChildren();
    Array.from(state.excluded).sort().forEach(word => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = word;
      button.setAttribute('aria-label', `Restore ${word}`);
      button.addEventListener('click', () => {
        state.excluded.delete(word);
        renderExcluded();
        analyze();
      });
      elements.excludedList.appendChild(button);
    });
  }

  function renderSources(pages) {
    elements.sourceList.replaceChildren();
    pages.forEach(page => {
      const item = document.createElement('li');
      item.classList.toggle('error', page.status === 'error');
      item.textContent = page.status === 'ok' ? `${page.url} — ${page.words.toLocaleString()} words` : `${page.url} — ${page.error}`;
      elements.sourceList.appendChild(item);
    });
    elements.sourceReport.hidden = false;
  }

  function renderReport(report) {
    elements.wordList.replaceChildren();
    const maximum = report.results.length ? report.results[0].count : 1;
    report.results.forEach((result, index) => {
      const row = document.createElement('li');
      row.className = 'word-row';
      const button = document.createElement('button');
      button.className = 'word-button';
      button.type = 'button';
      button.textContent = result.word;
      button.title = `Exclude “${result.word}”`;
      button.addEventListener('click', () => {
        state.excluded.add(result.word);
        renderExcluded();
        analyze();
      });
      const track = document.createElement('span');
      track.className = 'bar-track';
      const bar = document.createElement('span');
      bar.className = 'bar-fill';
      bar.style.width = `${(result.count / maximum) * 100}%`;
      bar.style.animationDelay = `${index * 25}ms`;
      track.appendChild(bar);
      const count = document.createElement('span');
      count.className = 'word-count';
      count.textContent = result.count.toLocaleString();
      row.append(button, track, count);
      elements.wordList.appendChild(row);
    });

    elements.pageTotal.textContent = report.successful_pages.toLocaleString();
    elements.wordTotal.textContent = report.total_words.toLocaleString();
    elements.uniqueTotal.textContent = report.unique_words.toLocaleString();
    elements.summary.hidden = false;
    elements.resultsSubtitle.textContent = `${report.results.length} words ranked by frequency.`;
    renderSources(report.pages);
    setView('results');
  }

  async function analyze() {
    if (state.analyzing) return;
    const payload = currentPayload();
    const emptyIndex = payload.urls.findIndex(url => !url);
    if (emptyIndex !== -1) {
      const input = elements.urlList.querySelectorAll('input')[emptyIndex];
      input.focus();
      input.reportValidity();
      return;
    }

    state.lastPayload = payload;
    state.analyzing = true;
    elements.analyzeButton.disabled = true;
    elements.summary.hidden = true;
    elements.sourceReport.hidden = true;
    elements.resultsSubtitle.textContent = `Scanning ${payload.urls.length} ${payload.urls.length === 1 ? 'page' : 'pages'}...`;
    setView('loading');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const report = await response.json();
      if (!response.ok) throw new Error(report.error || 'The analysis could not be completed.');
      renderReport(report);
    } catch (error) {
      elements.errorState.textContent = error.message;
      elements.resultsSubtitle.textContent = 'Scan failed.';
      setView('error');
    } finally {
      state.analyzing = false;
      elements.analyzeButton.disabled = false;
    }
  }

  elements.urlCount.addEventListener('change', renderUrlFields);
  elements.randomUrlButton.addEventListener('click', fillRandomUrls);
  elements.form.addEventListener('submit', event => { event.preventDefault(); analyze(); });
  elements.sourceToggle.addEventListener('click', () => {
    const expanded = elements.sourceToggle.getAttribute('aria-expanded') === 'true';
    elements.sourceToggle.setAttribute('aria-expanded', String(!expanded));
    elements.sourceToggle.querySelector('span').textContent = expanded ? '+' : '−';
    elements.sourceList.hidden = expanded;
  });

  renderUrlFields();
}());