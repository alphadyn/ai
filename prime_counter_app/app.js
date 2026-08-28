const MAX_LIMIT = 10n * 10n ** 20n; // 10E20 (1e21)
const DIRECT_SIEVE_LIMIT = 150_000_000; // largest N attempted with an exact sieve
const TIME_BUDGET_MS = 5000; // abort the exact sieve and fall back to an estimate past this
const LOG_KEY = "primeCounterLog";
const LOG_LIMIT = 100;

const form = document.getElementById("prime-form");
const input = document.getElementById("limit-input");
const errorMsg = document.getElementById("error-msg");
const resultCard = document.getElementById("result-card");
const primeCountEl = document.getElementById("prime-count");
const resultMethodEl = document.getElementById("result-method");
const elapsedTimeEl = document.getElementById("elapsed-time");
const logBody = document.getElementById("log-body");
const logEmpty = document.getElementById("log-empty");
const logCountEl = document.getElementById("log-count");
const clearLogBtn = document.getElementById("clear-log-btn");
const densityChart = document.getElementById("density-chart");
const chartEmpty = document.getElementById("chart-empty");

// Parses plain integers or scientific notation (e.g. "1e20") into an exact BigInt.
function parseLimitInput(raw) {
  const trimmed = raw.trim();
  const match = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(trimmed);
  if (!match) return null;

  const [, intPart, fracPart = "", expPart] = match;
  const exponent = expPart ? parseInt(expPart, 10) : 0;
  const digits = intPart + fracPart;
  const shift = exponent - fracPart.length;

  if (shift >= 0) {
    return BigInt(digits + "0".repeat(shift));
  }

  const dropCount = -shift;
  const keepLength = digits.length - dropCount;
  const kept = keepLength > 0 ? digits.slice(0, keepLength) : "0";
  const dropped = digits.slice(Math.max(keepLength, 0));
  if (!/^0*$/.test(dropped)) return null; // input isn't a whole number
  return BigInt(kept);
}

// Sieve of Eratosthenes, checked periodically against a time budget.
function sieveCountWithBudget(limit, startTime) {
  const isComposite = new Uint8Array(limit + 1);
  const checkInterval = 2_000_000;
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
    if (n % checkInterval === 0 && performance.now() - startTime > TIME_BUDGET_MS) {
      return { count, timedOut: true };
    }
  }

  return { count, timedOut: false };
}

// Asymptotic estimate of pi(x) via x/ln(x) * sum(k! / ln(x)^k), used when an
// exact sieve isn't feasible within the time budget.
function estimatePrimeCount(nBig) {
  const x = Number(nBig);
  if (x < 2) return 0;

  const lnX = Math.log(x);
  const TERMS = 10;
  let sum = 0;
  let factorial = 1;

  for (let k = 0; k <= TERMS; k++) {
    sum += factorial / lnX ** k;
    factorial *= k + 1;
  }

  return Math.round((x / lnX) * sum);
}

function computePrimeCount(limitBig) {
  const startTime = performance.now();

  if (limitBig <= BigInt(DIRECT_SIEVE_LIMIT)) {
    const { count, timedOut } = sieveCountWithBudget(Number(limitBig), startTime);
    if (!timedOut) {
      return { count, isExact: true, elapsedMs: performance.now() - startTime };
    }
  }

  const count = estimatePrimeCount(limitBig);
  return { count, isExact: false, elapsedMs: performance.now() - startTime };
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
      <td>${BigInt(entry.limit).toLocaleString()}</td>
      <td>${entry.isExact ? "" : "~"}${entry.primeCount.toLocaleString()}</td>
      <td>${entry.isExact ? "Exact" : "Estimated"}</td>
      <td>${entry.elapsedLabel}</td>
      <td>${entry.when}</td>
    `;
    logBody.appendChild(row);
  });

  drawDensityChart(log);
}

// Scatter plot of N (log-scale x-axis) vs. prime density percentage (primeCount / N * 100).
function drawDensityChart(log) {
  const ctx = densityChart.getContext("2d");
  const { width, height } = densityChart;
  ctx.clearRect(0, 0, width, height);

  const points = log
    .map((entry) => {
      const n = Number(BigInt(entry.limit));
      return { n, ratio: n > 0 ? (entry.primeCount / n) * 100 : 0 };
    })
    .filter((p) => p.n > 0);

  densityChart.hidden = points.length === 0;
  chartEmpty.hidden = points.length > 0;
  if (points.length === 0) return;

  const margin = { top: 16, right: 20, bottom: 42, left: 64 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const logNs = points.map((p) => Math.log10(p.n));
  const minLogN = Math.min(...logNs);
  const maxLogN = Math.max(...logNs);
  const logSpan = maxLogN - minLogN || 1;
  const maxRatio = Math.max(...points.map((p) => p.ratio), 0.001);

  const xFor = (logN) => margin.left + ((logN - minLogN) / logSpan) * plotW;
  const yFor = (ratio) => margin.top + plotH - (ratio / maxRatio) * plotH;

  ctx.strokeStyle = "#2a2f4a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + plotH);
  ctx.lineTo(margin.left + plotW, margin.top + plotH);
  ctx.stroke();

  ctx.fillStyle = "#9aa0c3";
  ctx.font = "11px sans-serif";

  ctx.textAlign = "right";
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const ratioVal = (maxRatio / yTicks) * i;
    const y = yFor(ratioVal);
    ctx.strokeStyle = "#2a2f4a";
    ctx.beginPath();
    ctx.moveTo(margin.left - 4, y);
    ctx.lineTo(margin.left, y);
    ctx.stroke();
    ctx.fillText(`${ratioVal.toFixed(ratioVal < 1 ? 3 : 1)}%`, margin.left - 8, y + 3);
  }

  ctx.textAlign = "center";
  const xTicks = Math.min(5, points.length > 1 ? 5 : 1);
  for (let i = 0; i <= xTicks; i++) {
    const logVal = minLogN + (logSpan / xTicks) * i;
    const x = xFor(logVal);
    ctx.strokeStyle = "#2a2f4a";
    ctx.beginPath();
    ctx.moveTo(x, margin.top + plotH);
    ctx.lineTo(x, margin.top + plotH + 4);
    ctx.stroke();
    ctx.fillText(`10^${logVal.toFixed(1)}`, x, margin.top + plotH + 16);
  }

  ctx.fillStyle = "#5b8cff";
  points.forEach((p) => {
    const x = xFor(Math.log10(p.n));
    const y = yFor(p.ratio);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
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
  const limit = rawValue === "" ? null : parseLimitInput(rawValue);

  if (limit === null || limit < 0n) {
    showError("Please enter a positive whole number (0 or greater).");
    return;
  }

  if (limit > MAX_LIMIT) {
    showError(`Please enter a value up to ${MAX_LIMIT.toLocaleString()} (10E20).`);
    return;
  }

  const { count, isExact, elapsedMs } = computePrimeCount(limit);

  primeCountEl.textContent = `${isExact ? "" : "~"}${count.toLocaleString()}`;
  resultMethodEl.textContent = isExact ? "Exact" : "Estimated (time budget exceeded)";
  resultMethodEl.classList.toggle("estimated", !isExact);
  elapsedTimeEl.textContent = formatElapsed(elapsedMs);
  resultCard.hidden = false;

  addLogEntry({
    limit: limit.toString(),
    primeCount: count,
    isExact,
    elapsedLabel: formatElapsed(elapsedMs),
    when: new Date().toLocaleString(),
  });
});

clearLogBtn.addEventListener("click", () => {
  saveLog([]);
  renderLog([]);
});

renderLog(loadLog());
