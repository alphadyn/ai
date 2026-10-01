/**
 * Multi-Search Engine Reporter - Frontend Controller
 * Searches a word or phrase across up to 5 search engines and produces
 * a structured report with one-line findings: [Source] Matching Text — Link
 */

(function () {
  'use strict';

  // State
  const state = {
    selectedEngines: ['duckduckgo', 'bing', 'wikipedia', 'hackernews', 'github'],
    maxResultsPerEngine: 10,
    currentQuery: '',
    resultsData: null,
    activeTab: 'interactive',
    theme: localStorage.getItem('metaSearchTheme') || 'dark',
  };

  const MAX_ENGINES_ALLOWED = 5;

  const ENGINE_CONFIG = {
    duckduckgo: {
      name: 'DuckDuckGo',
      desc: 'Privacy Web Index',
      directUrl: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
      badgeClass: 'DuckDuckGo',
    },
    bing: {
      name: 'Bing',
      desc: 'Microsoft Search',
      directUrl: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
      badgeClass: 'Bing',
    },
    wikipedia: {
      name: 'Wikipedia',
      desc: 'Live Encyclopedia API',
      directUrl: (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
      badgeClass: 'Wikipedia',
    },
    hackernews: {
      name: 'HackerNews',
      desc: 'Live Web Discussions',
      directUrl: (q) => `https://hn.algolia.com/?q=${encodeURIComponent(q)}`,
      badgeClass: 'HackerNews',
    },
    github: {
      name: 'GitHub',
      desc: 'Live Repositories API',
      directUrl: (q) => `https://github.com/search?q=${encodeURIComponent(q)}`,
      badgeClass: 'GitHub',
    },
    openalex: {
      name: 'OpenAlex',
      desc: 'Scholarly Research API',
      directUrl: (q) => `https://openalex.org/works?search=${encodeURIComponent(q)}`,
      badgeClass: 'OpenAlex',
    },
    google: {
      name: 'Google',
      desc: 'Global Web Search',
      directUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      badgeClass: 'Google',
    },
    yahoo: {
      name: 'Yahoo',
      desc: 'Yahoo Search Network',
      directUrl: (q) => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`,
      badgeClass: 'Yahoo',
    },
    arxiv: {
      name: 'arXiv',
      desc: 'Scientific Preprints',
      directUrl: (q) => `https://arxiv.org/search/?query=${encodeURIComponent(q)}&searchtype=all`,
      badgeClass: 'arXiv',
    },
    brave: {
      name: 'Brave',
      desc: 'Independent Index',
      directUrl: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
      badgeClass: 'Brave',
    },
    ecosia: {
      name: 'Ecosia',
      desc: 'Eco Search Engine',
      directUrl: (q) => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}`,
      badgeClass: 'Ecosia',
    },
  };

  // DOM Elements
  const queryInput = document.getElementById('queryInput');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const searchForm = document.getElementById('searchForm');
  const searchBtn = document.getElementById('searchBtn');
  const engineGrid = document.getElementById('engineGrid');
  const engineCounter = document.getElementById('engineCounter');
  const engineLimitWarning = document.getElementById('engineLimitWarning');
  const maxResultsSelect = document.getElementById('maxResultsSelect');
  const selectDefault5Btn = document.getElementById('selectDefault5Btn');
  const clearAllEnginesBtn = document.getElementById('clearAllEnginesBtn');

  const progressSection = document.getElementById('progressSection');
  const progressBar = document.getElementById('progressBar');
  const overallProgressText = document.getElementById('overallProgressText');
  const engineProgressList = document.getElementById('engineProgressList');

  const reportSection = document.getElementById('reportSection');
  const emptyState = document.getElementById('emptyState');
  const reportQueryTitle = document.getElementById('reportQueryTitle');
  const metaTotalFindings = document.getElementById('metaTotalFindings');
  const metaEnginesCount = document.getElementById('metaEnginesCount');
  const metaLimitCount = document.getElementById('metaLimitCount');
  const metaTimestamp = document.getElementById('metaTimestamp');

  const findingsList = document.getElementById('findingsList');
  const rawOneLineOutput = document.getElementById('rawOneLineOutput');
  const groupedEngineContainer = document.getElementById('groupedEngineContainer');
  const directLinksGroup = document.getElementById('directLinksGroup');
  const filterResultsInput = document.getElementById('filterResultsInput');
  const tabCountInteractive = document.getElementById('tabCountInteractive');

  const copyOneLineBtn = document.getElementById('copyOneLineBtn');
  const copyRawBoxBtn = document.getElementById('copyRawBoxBtn');
  const downloadTxtBtn = document.getElementById('downloadTxtBtn');
  const downloadMdBtn = document.getElementById('downloadMdBtn');
  const downloadJsonBtn = document.getElementById('downloadJsonBtn');

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const toastNotification = document.getElementById('toastNotification');

  // Initialize
  function init() {
    applyTheme(state.theme);
    bindEvents();
    updateEngineCheckboxes();
  }

  // Theme Handling
  function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem('metaSearchTheme', theme);
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');
  }

  // Event Listeners
  function bindEvents() {
    // Theme toggle
    themeToggleBtn.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    // Input changes
    queryInput.addEventListener('input', () => {
      clearInputBtn.classList.toggle('visible', queryInput.value.length > 0);
    });

    queryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSearch();
      }
    });

    clearInputBtn.addEventListener('click', () => {
      queryInput.value = '';
      clearInputBtn.classList.remove('visible');
      queryInput.focus();
    });

    // Search trigger
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      executeSearch();
    });

    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      executeSearch();
    });

    // Suggestion chips
    document.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.query;
        queryInput.value = q;
        clearInputBtn.classList.add('visible');
        executeSearch();
      });
    });

    // Engine checkbox selection handling
    engineGrid.addEventListener('change', (e) => {
      if (e.target.name === 'engine') {
        handleEngineToggle(e.target);
      }
    });

    // Quick engine actions
    selectDefault5Btn.addEventListener('click', () => {
      state.selectedEngines = ['duckduckgo', 'bing', 'wikipedia', 'hackernews', 'github'];
      updateEngineCheckboxes();
    });

    clearAllEnginesBtn.addEventListener('click', () => {
      state.selectedEngines = [];
      updateEngineCheckboxes();
    });

    maxResultsSelect.addEventListener('change', () => {
      state.maxResultsPerEngine = parseInt(maxResultsSelect.value, 10) || 10;
    });

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabKey = btn.dataset.tab;
        switchTab(tabKey);
      });
    });

    // Filter findings
    filterResultsInput.addEventListener('input', () => {
      renderInteractiveFindings(filterResultsInput.value.trim());
    });

    // Export & Copy Actions
    copyOneLineBtn.addEventListener('click', () => copyOneLineReport());
    copyRawBoxBtn.addEventListener('click', () => copyOneLineReport());
    downloadTxtBtn.addEventListener('click', () => downloadReport('txt'));
    downloadMdBtn.addEventListener('click', () => downloadReport('md'));
    downloadJsonBtn.addEventListener('click', () => downloadReport('json'));
  }

  // Engine selection logic (Max 5 search engines)
  function handleEngineToggle(targetCheckbox) {
    const engineKey = targetCheckbox.value;
    const isChecked = targetCheckbox.checked;

    if (isChecked) {
      if (state.selectedEngines.length >= MAX_ENGINES_ALLOWED) {
        // Prevent 6th engine
        targetCheckbox.checked = false;
        showEngineLimitWarning();
        return;
      }
      if (!state.selectedEngines.includes(engineKey)) {
        state.selectedEngines.push(engineKey);
      }
      hideEngineLimitWarning();
    } else {
      state.selectedEngines = state.selectedEngines.filter((k) => k !== engineKey);
      hideEngineLimitWarning();
    }

    updateEngineCheckboxes();
  }

  function updateEngineCheckboxes() {
    const checkboxes = engineGrid.querySelectorAll('input[name="engine"]');
    checkboxes.forEach((cb) => {
      const isSelected = state.selectedEngines.includes(cb.value);
      cb.checked = isSelected;
      const card = cb.closest('.engine-card');
      if (card) {
        card.classList.toggle('active', isSelected);
      }
    });

    // Update Counter badge
    const count = state.selectedEngines.length;
    engineCounter.textContent = `${count} / ${MAX_ENGINES_ALLOWED} Selected`;
    engineCounter.style.color = count === 0 ? 'var(--accent-rose)' : 'var(--accent-cyan)';
  }

  function showEngineLimitWarning() {
    engineLimitWarning.classList.remove('hidden');
    setTimeout(() => {
      engineLimitWarning.classList.add('hidden');
    }, 4000);
  }

  function hideEngineLimitWarning() {
    engineLimitWarning.classList.add('hidden');
  }

  function switchTab(tabKey) {
    state.activeTab = tabKey;
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });
    document.getElementById('tabContentInteractive').classList.toggle('active', tabKey === 'interactive');
    document.getElementById('tabContentOneLine').classList.toggle('active', tabKey === 'oneline');
    document.getElementById('tabContentByEngine').classList.toggle('active', tabKey === 'byengine');
  }

  // -------------------------------------------------------------------------
  // Search Execution & Data Fetching
  // -------------------------------------------------------------------------

  async function executeSearch() {
    const query = queryInput.value.trim();
    if (!query) {
      showToast('Please enter a word or phrase to search.');
      queryInput.focus();
      return;
    }

    if (state.selectedEngines.length === 0) {
      showToast('Please select at least 1 search engine (up to 5).');
      return;
    }

    state.currentQuery = query;
    state.maxResultsPerEngine = parseInt(maxResultsSelect.value, 10) || 10;

    // UI state for loading
    setLoading(true);
    progressSection.classList.remove('hidden');
    emptyState.classList.add('hidden');
    reportSection.classList.add('hidden');

    renderProgressBadges();

    try {
      // 1. First attempt: call local Python backend if available
      let data = await tryBackendApiSearch(query, state.selectedEngines, state.maxResultsPerEngine);

      // 2. If backend is not running, run client-side search aggregator
      if (!data) {
        data = await performClientSideSearch(query, state.selectedEngines, state.maxResultsPerEngine);
      }

      state.resultsData = data;
      renderReport(data);
    } catch (err) {
      console.error('Search error:', err);
      // Fallback in case of any unhandled network exception
      const fallbackData = buildFallbackDataSet(query, state.selectedEngines, state.maxResultsPerEngine);
      state.resultsData = fallbackData;
      renderReport(fallbackData);
    } finally {
      setLoading(false);
      progressSection.classList.add('hidden');
    }
  }

  function setLoading(isLoading) {
    searchBtn.disabled = isLoading;
    const btnText = searchBtn.querySelector('.btn-text');
    const spinner = searchBtn.querySelector('.btn-spinner');
    if (isLoading) {
      btnText.textContent = 'Searching...';
      spinner.classList.remove('hidden');
    } else {
      btnText.textContent = 'Search Engines';
      spinner.classList.add('hidden');
    }
  }

  function renderProgressBadges() {
    engineProgressList.innerHTML = '';
    progressBar.style.width = '15%';
    overallProgressText.textContent = 'Querying engines...';

    state.selectedEngines.forEach((engineKey) => {
      const conf = ENGINE_CONFIG[engineKey];
      const badge = document.createElement('div');
      badge.className = 'engine-progress-badge';
      badge.id = `prog-${engineKey}`;
      badge.innerHTML = `<span>⏳</span> <strong>${conf ? conf.name : engineKey}</strong> (Querying...)`;
      engineProgressList.appendChild(badge);
    });
  }

  function updateEngineProgress(engineKey, resultCount) {
    const badge = document.getElementById(`prog-${engineKey}`);
    const conf = ENGINE_CONFIG[engineKey];
    if (badge) {
      badge.classList.add('done');
      badge.innerHTML = `<span>✓</span> <strong>${conf ? conf.name : engineKey}</strong> (${resultCount} results)`;
    }
  }

  // Try Python Server API
  async function tryBackendApiSearch(query, engines, maxResults) {
    const endpoints = [
      `/api/search`,
      `http://127.0.0.1:8000/api/search`,
      `http://localhost:8000/api/search`,
    ];

    const params = new URLSearchParams({
      q: query,
      engines: engines.join(','),
      max_results: maxResults.toString(),
    });

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const url = `${ep}?${params.toString()}`;
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const json = await response.json();
          if (json && json.all_results && json.all_results.length > 0) {
            return json;
          }
        }
      } catch (e) {
        // Try next endpoint
      }
    }
    return null;
  }

  // Client-Side Search Engine with Real API queries and intelligent fallback
  async function performClientSideSearch(query, engines, maxResults) {
    const resultsByEngine = {};
    const allResults = [];
    const oneLineReport = [];
    const queriedNames = [];

    const totalEngines = engines.length;
    let completed = 0;

    for (const engineKey of engines) {
      const conf = ENGINE_CONFIG[engineKey] || { name: engineKey, badgeClass: engineKey };
      queriedNames.push(conf.name);

      let findings = [];
      if (engineKey === 'wikipedia') {
        findings = await fetchWikipediaClient(query, maxResults);
      } else if (engineKey === 'hackernews') {
        findings = await fetchHackerNewsClient(query, maxResults);
      } else if (engineKey === 'github') {
        findings = await fetchGitHubClient(query, maxResults);
      } else if (engineKey === 'openalex') {
        findings = await fetchOpenAlexClient(query, maxResults);
      } else if (engineKey === 'arxiv') {
        findings = await fetchArxivClient(query, maxResults);
      } else if (['bing', 'duckduckgo', 'google', 'yahoo', 'brave', 'ecosia'].includes(engineKey)) {
        findings = await fetchBingWebClient(engineKey, query, maxResults);
      } else {
        findings = generateClientFallbackResults(conf.name, query, maxResults);
      }

      // Start from a clean result set and only keep valid received items.
      findings = (findings || [])
        .map((f) => normalizeResultItem(f))
        .filter(Boolean)
        .slice(0, maxResults);

      resultsByEngine[conf.name] = findings;
      findings.forEach((f) => {
        allResults.push(f);
        oneLineReport.push(f.one_line || `[${f.engine}] [${f.summary || f.matching_text || f.title}](${f.link})`);
      });

      completed++;
      progressBar.style.width = `${Math.round((completed / totalEngines) * 100)}%`;
      overallProgressText.textContent = `${Math.round((completed / totalEngines) * 100)}% Completed`;
      updateEngineProgress(engineKey, findings.length);
    }

    return {
      query: query,
      timestamp: new Date().toLocaleString(),
      engines_queried: queriedNames,
      max_results_per_engine: maxResults,
      total_results: allResults.length,
      results_by_engine: resultsByEngine,
      all_results: allResults,
      one_line_report: oneLineReport,
    };
  }

  async function fetchBingWebClient(engineKey, query, maxResults) {
    const findings = [];
    const engineName = ENGINE_CONFIG[engineKey]?.name || engineKey;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
      const resp = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/html,application/xhtml+xml' } });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        return [];
      }

      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const blocks = doc.querySelectorAll('li.b_algo');

      blocks.forEach((block) => {
        const linkEl = block.querySelector('h2 a');
        const titleEl = block.querySelector('h2');
        const snippetEl = block.querySelector('p');
        if (!linkEl) return;

        const rawHref = linkEl.getAttribute('href') || '';
        const link = decodeBingHref(rawHref) || rawHref;
        const title = (titleEl ? titleEl.textContent : '') || linkEl.textContent || 'Bing result';
        const snippet = snippetEl ? cleanHtmlSnippet(snippetEl.innerHTML) : `Live web result for ${query}`;

        if (title && link && link.startsWith('http')) {
          const summary = `${title}: ${snippet}`;
          findings.push({
            engine: engineName,
            title: title.replace(/\s+/g, ' ').trim(),
            snippet: snippet.replace(/\s+/g, ' ').trim(),
            summary,
            matching_text: summary,
            link,
            one_line: `[${engineName}] [${summary}](${link})`,
          });
        }
      });
    } catch (e) {
      return [];
    }

    return findings.slice(0, maxResults);
  }

  function decodeBingHref(rawHref) {
    if (!rawHref) return '';
    try {
      const url = new URL(rawHref, 'https://www.bing.com');
      const uParam = url.searchParams.get('u');
      if (uParam) {
        const b64 = uParam.replace(/^a1/, '');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
        const decodedUrl = decodeURIComponent(escape(decoded));
        if (decodedUrl.startsWith('http')) return decodedUrl;
      }
      return rawHref.startsWith('http') ? rawHref : url.href;
    } catch (e) {
      return rawHref.startsWith('http') ? rawHref : '';
    }
  }

  // Client fetch Wikipedia MediaWiki API (CORS enabled)
  async function fetchWikipediaClient(query, maxResults) {
    const findings = [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=${maxResults}`;
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        const searchItems = (data.query && data.query.search) || [];
        searchItems.forEach((item) => {
          const title = item.title;
          const cleanSnippet = cleanHtmlSnippet(item.snippet);
          const link = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;
          const summary = cleanSnippet || `Wikipedia encyclopedic article for ${title}`;
          const matchingText = `${title}: ${summary}`;
          const oneLine = `[Wikipedia] [${matchingText}](${link})`;
          findings.push({
            engine: 'Wikipedia',
            title: title,
            snippet: cleanSnippet,
            summary: matchingText,
            matching_text: matchingText,
            link: link,
            one_line: oneLine,
          });
        });
      }
    } catch (e) {
      // Fallback
    }

    if (findings.length === 0) {
      return generateClientFallbackResults('Wikipedia', query, maxResults);
    }
    return findings;
  }

  // Client fetch HackerNews Algolia live API (CORS enabled)
  async function fetchHackerNewsClient(query, maxResults) {
    const findings = [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${maxResults}`;
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        const hits = data.hits || [];
        hits.forEach((h) => {
          const title = h.title || h.story_title || 'Hacker News Finding';
          const author = h.author || 'community';
          const points = h.points || 0;
          const comments = h.num_comments || 0;
          const snippet = `Submitted by ${author} (${points} points, ${comments} comments). Discussion on ${query}.`;
          const link = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
          const summary = `${title}: ${snippet}`;
          const oneLine = `[HackerNews] [${summary}](${link})`;
          findings.push({
            engine: 'HackerNews',
            title: title,
            snippet: snippet,
            summary: summary,
            matching_text: summary,
            link: link,
            one_line: oneLine,
          });
        });
      }
    } catch (e) {
      // Fallback
    }

    return findings;
  }

  // Client fetch GitHub public repositories API (CORS enabled)
  async function fetchGitHubClient(query, maxResults) {
    const findings = [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${maxResults}`;
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        const items = data.items || [];
        items.forEach((item) => {
          const title = item.full_name;
          const desc = item.description || `Repository and source code related to ${query}`;
          const stars = item.stargazers_count || 0;
          const lang = item.language || 'Code';
          const snippet = `${desc} (${lang}, ${stars} stars)`;
          const link = item.html_url || `https://github.com/${item.full_name}`;
          const summary = `${title}: ${snippet}`;
          const oneLine = `[GitHub] [${summary}](${link})`;
          findings.push({
            engine: 'GitHub',
            title: title,
            snippet: snippet,
            summary: summary,
            matching_text: summary,
            link: link,
            one_line: oneLine,
          });
        });
      }
    } catch (e) {
      // Fallback
    }

    return findings;
  }

  // Client fetch OpenAlex Scholarly live API (CORS enabled)
  async function fetchOpenAlexClient(query, maxResults) {
    const findings = [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${maxResults}`;
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        const results = data.results || [];
        results.forEach((item) => {
          const title = item.title;
          const pubYear = item.publication_year || '';
          const cited = item.cited_by_count || 0;
          const snippet = `Peer-reviewed research paper (${pubYear}, cited ${cited} times) on ${query}.`;
          const link = item.doi || item.id || `https://openalex.org/works?search=${encodeURIComponent(query)}`;
          if (title && link) {
            const summary = `${title}: ${snippet}`;
            const oneLine = `[OpenAlex] [${summary}](${link})`;
            findings.push({
              engine: 'OpenAlex',
              title: title,
              snippet: snippet,
              summary: summary,
              matching_text: summary,
              link: link,
              one_line: oneLine,
            });
          }
        });
      }
    } catch (e) {
      // Fallback
    }

    return findings;
  }

  // Client fetch arXiv Open API
  async function fetchArxivClient(query, maxResults) {
    const findings = [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}`;
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const text = await resp.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'application/xml');
        const entries = xmlDoc.querySelectorAll('entry');
        entries.forEach((entry) => {
          const titleEl = entry.querySelector('title');
          const summaryEl = entry.querySelector('summary');
          const idEl = entry.querySelector('id');
          if (titleEl && idEl) {
            const title = titleEl.textContent.replace(/\s+/g, ' ').trim();
            const snippet = summaryEl ? summaryEl.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) + '...' : `Academic research paper on ${query}`;
            const link = idEl.textContent.trim();
            const summary = `${title}: ${snippet}`;
            const oneLine = `[arXiv] [${summary}](${link})`;
            findings.push({
              engine: 'arXiv',
              title: title,
              snippet: snippet,
              summary: summary,
              matching_text: summary,
              link: link,
              one_line: oneLine,
            });
          }
        });
      }
    } catch (e) {
      // Fallback
    }

    return findings;
  }

  function cleanHtmlSnippet(str) {
    const temp = document.createElement('div');
    temp.innerHTML = str;
    return (temp.textContent || temp.innerText || '').replace(/\s+/g, ' ').trim();
  }

  // Generate structured relevant destination article results for search engines
  function generateClientFallbackResults(engineName, query, maxResults) {
    return [];
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function buildFallbackDataSet(query, engines, maxResults) {
    const resultsByEngine = {};
    const allResults = [];
    const oneLineReport = [];
    const queriedNames = [];

    engines.forEach((eKey) => {
      const conf = ENGINE_CONFIG[eKey] || { name: eKey, badgeClass: eKey };
      queriedNames.push(conf.name);
      const findings = (generateClientFallbackResults(conf.name, query, maxResults) || [])
        .map((f) => normalizeResultItem(f))
        .filter(Boolean);
      resultsByEngine[conf.name] = findings;
      findings.forEach((f) => {
        allResults.push(f);
        oneLineReport.push(f.one_line || `[${f.engine}] [${f.summary || f.matching_text || f.title}](${f.link})`);
      });
    });

    return {
      query: query,
      timestamp: new Date().toLocaleString(),
      engines_queried: queriedNames,
      max_results_per_engine: maxResults,
      total_results: allResults.length,
      results_by_engine: resultsByEngine,
      all_results: allResults,
      one_line_report: oneLineReport,
    };
  }

  // -------------------------------------------------------------------------
  // Report Rendering
  // -------------------------------------------------------------------------

  function normalizeResultItem(item) {
    if (!item || typeof item !== 'object') return null;

    const title = String(item.title || item.summary || item.matching_text || '').replace(/\s+/g, ' ').trim();
    const snippet = String(item.snippet || item.summary || item.matching_text || '').replace(/\s+/g, ' ').trim();
    const link = String(item.link || '').trim();

    if (!link || !link.startsWith('http')) return null;
    if (!title && !snippet) return null;

    return {
      ...item,
      title: title || 'Search Result',
      snippet: snippet || 'Relevant result',
      summary: item.summary || item.matching_text || `${title || 'Result'}: ${snippet || 'Relevant result'}`,
      matching_text: item.matching_text || item.summary || `${title || 'Result'}: ${snippet || 'Relevant result'}`,
      link,
    };
  }

  function renderReport(data) {
    reportSection.classList.remove('hidden');

    // Headers & Meta
    reportQueryTitle.textContent = `Search Report for "${data.query}"`;
    metaTotalFindings.textContent = `${data.total_results} Total Findings`;
    metaEnginesCount.textContent = `${data.engines_queried.length} Search Engines`;
    metaLimitCount.textContent = `Max ${data.max_results_per_engine} / engine`;
    metaTimestamp.textContent = data.timestamp || new Date().toLocaleString();

    tabCountInteractive.textContent = data.total_results;

    // Render Tab 1: Interactive List
    renderInteractiveFindings('');

    // Render Tab 2: Raw One-Line Output
    rawOneLineOutput.value = data.one_line_report.join('\n');

    // Render Tab 3: Grouped by Engine
    renderGroupedByEngine(data);

    // Direct Search Shortcuts
    renderDirectLinks(data.query, data.engines_queried);

    // Scroll smoothly to report
    reportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function normalizeFilterTerm(rawTerm) {
    if (rawTerm == null) return '';
    const cleaned = String(rawTerm).replace(/[\*]+/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned;
  }

  function renderInteractiveFindings(filterTerm = '') {
    if (!state.resultsData) return;

    const normalizedTerm = normalizeFilterTerm(filterTerm);
    findingsList.innerHTML = '';
    const term = normalizedTerm.toLowerCase();

    const filtered = state.resultsData.all_results.filter((item) => {
      if (!term) return true;
      const textToFilter = (item.summary || item.matching_text || '') + ' ' + (item.engine || '') + ' ' + (item.link || '');
      return textToFilter.toLowerCase().includes(term);
    });

    if (filtered.length === 0) {
      const emptyMessage = term ? `No search findings matching "<strong>${escapeHtml(normalizedTerm)}</strong>".` : 'No search findings available for this query.';
      findingsList.innerHTML = `
        <div class="empty-filter-state" style="padding: 2rem; text-align: center; color: var(--text-dim);">
          ${emptyMessage}
        </div>
      `;
      return;
    }

    filtered.forEach((item) => {
      const row = document.createElement('a');
      row.className = 'finding-item finding-link-card';
      row.href = item.link;
      row.target = '_blank';
      row.rel = 'noopener noreferrer';
      row.title = `Open article: ${item.link}`;

      const summaryText = item.summary || item.matching_text || `${item.title}: ${item.snippet}`;
      const highlightedSummary = highlightQuery(summaryText, state.currentQuery);

      row.innerHTML = `
        <div class="finding-content">
          <div class="finding-header-line">
            <span class="source-badge ${escapeHtml(item.engine)}">${escapeHtml(item.engine)}</span>
            <span class="destination-url">${escapeHtml(item.link)}</span>
          </div>
          <div class="finding-summary-text">${highlightedSummary}</div>
        </div>
      `;
      findingsList.appendChild(row);
    });
  }

  function renderGroupedByEngine(data) {
    groupedEngineContainer.innerHTML = '';

    Object.entries(data.results_by_engine).forEach(([engineName, items]) => {
      const groupCard = document.createElement('div');
      groupCard.className = 'engine-group-card';

      const header = document.createElement('div');
      header.className = 'engine-group-header';
      header.innerHTML = `
        <div class="engine-group-title">
          <span class="source-badge ${escapeHtml(engineName)}">${escapeHtml(engineName)}</span>
          <span>${escapeHtml(engineName)} Findings</span>
        </div>
        <span class="engine-group-count">${items.length} of ${data.max_results_per_engine} results</span>
      `;
      groupCard.appendChild(header);

      const list = document.createElement('div');
      list.className = 'findings-list';

      items.forEach((item) => {
        const row = document.createElement('a');
        row.className = 'finding-item finding-link-card';
        row.href = item.link;
        row.target = '_blank';
        row.rel = 'noopener noreferrer';
        row.title = `Open article: ${item.link}`;

        const summaryText = item.summary || item.matching_text || `${item.title}: ${item.snippet}`;

        row.innerHTML = `
          <div class="finding-content">
            <div class="finding-header-line">
              <span class="destination-url">${escapeHtml(item.link)}</span>
            </div>
            <div class="finding-summary-text">${highlightQuery(summaryText, state.currentQuery)}</div>
          </div>
        `;
        list.appendChild(row);
      });

      groupCard.appendChild(list);
      groupedEngineContainer.appendChild(groupCard);
    });
  }

  function renderDirectLinks(query, queriedEngines) {
    directLinksGroup.innerHTML = '';
    queriedEngines.forEach((engineName) => {
      const key = engineName.toLowerCase().replace(/\s+/g, '');
      const conf = Object.values(ENGINE_CONFIG).find((c) => c.name.toLowerCase() === engineName.toLowerCase());
      if (conf) {
        const a = document.createElement('a');
        a.href = conf.directUrl(query);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'direct-chip-link';
        a.innerHTML = `
          <span>Search in ${escapeHtml(conf.name)}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        `;
        directLinksGroup.appendChild(a);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Clipboard & Exports
  // -------------------------------------------------------------------------

  function copyOneLineReport() {
    if (!state.resultsData || !state.resultsData.one_line_report) {
      showToast('No search findings to copy.');
      return;
    }
    const textToCopy = state.resultsData.one_line_report.join('\n');
    navigator.clipboard.writeText(textToCopy).then(
      () => showToast(`Copied ${state.resultsData.total_results} one-line findings to clipboard!`),
      () => {
        // Fallback copy using textarea selection
        rawOneLineOutput.select();
        document.execCommand('copy');
        showToast('Copied to clipboard!');
      }
    );
  }

  function downloadReport(format) {
    if (!state.resultsData) {
      showToast('No report available to download.');
      return;
    }

    const data = state.resultsData;
    let content = '';
    let mimeType = 'text/plain';
    let ext = 'txt';

    const safeSlug = data.query.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);

    if (format === 'txt') {
      content = [
        '================================================================================',
        `MULTI-SEARCH ENGINE REPORT: "${data.query}"`,
        `Generated: ${data.timestamp} | Engines: ${data.engines_queried.join(', ')}`,
        `Total Findings: ${data.total_results} (Up to ${data.max_results_per_engine} results per engine)`,
        '================================================================================',
        '',
        'ONE-LINE SEARCH FINDINGS:',
        '--------------------------------------------------------------------------------',
        ...data.one_line_report,
        '--------------------------------------------------------------------------------',
        `End of Report (${data.total_results} items)`,
      ].join('\n');
      ext = 'txt';
      mimeType = 'text/plain';
    } else if (format === 'md') {
      content = [
        `# Multi-Search Engine Report: "${data.query}"`,
        ``,
        `- **Generated**: ${data.timestamp}`,
        `- **Engines Queried**: ${data.engines_queried.join(', ')}`,
        `- **Total Findings**: ${data.total_results} (Max ${data.max_results_per_engine} / engine)`,
        ``,
        `## One-Line Search Findings`,
        ``,
        ...data.one_line_report.map((line) => `- ${line}`),
        ``,
        `---`,
        `*Report created with MetaSearch Reporter Web App*`,
      ].join('\n');
      ext = 'md';
      mimeType = 'text/markdown';
    } else if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      ext = 'json';
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `search_report_${safeSlug}_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded search_report.${ext}`);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function highlightQuery(text, query) {
    if (!query) return escapeHtml(text);
    const words = query
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (words.length === 0) return escapeHtml(text);

    const regex = new RegExp(`(${words.join('|')})`, 'gi');
    const escaped = escapeHtml(text);
    return escaped.replace(regex, '<strong class="highlight">$1</strong>');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(msg) {
    toastNotification.textContent = msg;
    toastNotification.classList.remove('hidden');
    clearTimeout(toastNotification._timer);
    toastNotification._timer = setTimeout(() => {
      toastNotification.classList.add('hidden');
    }, 3200);
  }

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
