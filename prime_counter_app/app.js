const MAX_LIMIT = 20_000_000; // cap to keep the sieve responsive in-browser
const LOG_KEY = "primeCounterLog";
const LOG_LIMIT = 100;

const form = document.getElementById("prime-form");
const input = document.getElementById("limit-input");
const errorMsg = document.getElementById("error-msg");
const resultCard = document.getElementById("result-card");
const primeCountEl = document.getElementById("prime-count");
const elapsedTimeEl = document.getElementById("elapsed-time");
const logBody = document.getElementById("log-body");
const logEmpty = document.getElementById("log-empty");
const logCountEl = document.getElementById("log-count");
const clearLogBtn = document.getElementById("clear-log-btn");

// Sieve of Eratosthenes: returns the count of primes in [2, limit].
function countPrimesUpTo(limit) {
  if (limit < 2) return 0;

  const isComposite = new Uint8Array(limit + 1);
  let count = 0;

  for (let n = 2; n <= limit; n++) {
    if (!isComposite[n]) {
      count++;
      if (n * n <= limit) {
        for (let multiple = n * n; multiple <= limit; multiple += n) {
          isComposite[multiple] = 1;
        }
      }
    }
  }

  return count;
}

function formatElapsed(ms) {
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(3)} s`;
}

function loadLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLog(log) {
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

function renderLog(log) {
  logBody.innerHTML = "";
  logCountEl.textContent = `(${log.length})`;
  logEmpty.hidden = log.length > 0;

  log.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${log.length - index}</td>
      <td>${entry.limit.toLocaleString()}</td>
      <td>${entry.primeCount.toLocaleString()}</td>
      <td>${entry.elapsedLabel}</td>
      <td>${entry.when}</td>
    `;
    logBody.appendChild(row);
  });
}

function addLogEntry(entry) {
  const log = loadLog();
  log.unshift(entry);
  if (log.length > LOG_LIMIT) log.length = LOG_LIMIT;
  saveLog(log);
  renderLog(log);
}

function showError(message) {
  errorMsg.textContent = message;
  resultCard.hidden = true;
}

function clearError() {
  errorMsg.textContent = "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearError();

  const rawValue = input.value.trim();
  const limit = Number(rawValue);

  if (rawValue === "" || !Number.isInteger(limit) || limit < 0) {
    showError("Please enter a positive whole number (0 or greater).");
    return;
  }

  if (limit > MAX_LIMIT) {
    showError(`Please enter a value up to ${MAX_LIMIT.toLocaleString()} to keep the browser responsive.`);
    return;
  }

  const start = performance.now();
  const primeCount = countPrimesUpTo(limit);
  const elapsedMs = performance.now() - start;

  primeCountEl.textContent = primeCount.toLocaleString();
  elapsedTimeEl.textContent = formatElapsed(elapsedMs);
  resultCard.hidden = false;

  addLogEntry({
    limit,
    primeCount,
    elapsedLabel: formatElapsed(elapsedMs),
    when: new Date().toLocaleString(),
  });
});

clearLogBtn.addEventListener("click", () => {
  saveLog([]);
  renderLog([]);
});

renderLog(loadLog());
