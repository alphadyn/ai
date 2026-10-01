const INDEXABLE_EXTENSIONS = new Set(["txt", "md", "py", "json", "csv", "html"]);

const dirInput = document.getElementById("dirInput");
const searchInput = document.getElementById("searchInput");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

// Each entry: { path, text, tokenCounts: Map<token, count> }
let documents = [];

function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9]+/g) || [];
}

function buildTokenCounts(text) {
  const counts = new Map();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function indexFiles(fileList) {
  statusEl.textContent = "Indexing…";
  searchInput.disabled = true;
  documents = [];

  const files = Array.from(fileList).filter((file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    return INDEXABLE_EXTENSIONS.has(ext);
  });

  for (const file of files) {
    try {
      const text = await readFileAsText(file);
      documents.push({
        path: file.webkitRelativePath || file.name,
        text,
        tokenCounts: buildTokenCounts(text),
      });
    } catch {
      // Skip files that fail to read
    }
  }

  statusEl.textContent = `Indexed ${documents.length} file(s) out of ${files.length} candidate(s).`;
  searchInput.disabled = documents.length === 0;
  renderResults([]);
}

function scoreDocument(doc, queryTokens) {
  let score = 0;
  for (const token of queryTokens) {
    score += doc.tokenCounts.get(token) || 0;
  }
  return score;
}

function buildSnippet(text, queryTokens) {
  const lower = text.toLowerCase();
  let matchIndex = -1;
  for (const token of queryTokens) {
    const idx = lower.indexOf(token);
    if (idx !== -1 && (matchIndex === -1 || idx < matchIndex)) {
      matchIndex = idx;
    }
  }

  const radius = 60;
  const start = matchIndex === -1 ? 0 : Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, start + radius * 2);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < text.length) snippet = `${snippet}…`;

  const escaped = snippet.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  if (queryTokens.length === 0) return escaped;

  const pattern = new RegExp(`(${queryTokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return escaped.replace(pattern, "<mark>$1</mark>");
}

function renderResults(matches) {
  resultsEl.innerHTML = "";

  if (documents.length === 0) return;

  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = searchInput.value.trim() ? "No matches found." : "Type a search term above.";
    resultsEl.appendChild(empty);
    return;
  }

  for (const { doc, queryTokens } of matches) {
    const item = document.createElement("div");
    item.className = "result-item";

    const path = document.createElement("div");
    path.className = "result-path";
    path.textContent = doc.path;

    const snippet = document.createElement("div");
    snippet.className = "result-snippet";
    snippet.innerHTML = buildSnippet(doc.text, queryTokens);

    item.appendChild(path);
    item.appendChild(snippet);
    resultsEl.appendChild(item);
  }
}

function runSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    renderResults([]);
    return;
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    renderResults([]);
    return;
  }

  const matches = documents
    .map((doc) => ({ doc, queryTokens, score: scoreDocument(doc, queryTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  renderResults(matches);
}

dirInput.addEventListener("change", (event) => {
  indexFiles(event.target.files);
});

searchInput.addEventListener("input", runSearch);
