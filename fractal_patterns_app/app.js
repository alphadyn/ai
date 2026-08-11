const fractals = [
  {
    key: "mandelbrot",
    name: "Mandelbrot Set",
    description: "The most iconic fractal boundary: infinite complexity from a tiny formula.",
    detail: [4, 10]
  },
  {
    key: "julia",
    name: "Julia Set",
    description: "A Mandelbrot cousin that creates electric, cloud-like islands.",
    detail: [4, 10]
  },
  {
    key: "newton",
    name: "Newton Fractal",
    description: "Root-finding dynamics split the plane into kaleidoscopic basins.",
    detail: [4, 10]
  },
  {
    key: "sierpinski-triangle",
    name: "Sierpinski Triangle",
    description: "A triangle made of ever-smaller missing triangles.",
    detail: [2, 10]
  },
  {
    key: "sierpinski-carpet",
    name: "Sierpinski Carpet",
    description: "A recursive square lattice punched with central holes.",
    detail: [1, 7]
  },
  {
    key: "koch",
    name: "Koch Snowflake",
    description: "A snowflake edge with infinite perimeter from simple steps.",
    detail: [1, 7]
  },
  {
    key: "dragon",
    name: "Dragon Curve",
    description: "A folded-paper style fractal with a dramatic lightning silhouette.",
    detail: [6, 10]
  },
  {
    key: "barnsley",
    name: "Barnsley Fern",
    description: "A natural-looking fern generated with a probabilistic system.",
    detail: [4, 10]
  },
  {
    key: "tree",
    name: "Fractal Tree",
    description: "Branching geometry that mimics botanical growth.",
    detail: [3, 10]
  },
  {
    key: "cantor",
    name: "Cantor Set",
    description: "A foundational fractal made by repeatedly removing middle thirds.",
    detail: [2, 10]
  }
];

const selectEl = document.getElementById("fractal-select");
const detailEl = document.getElementById("detail");
const detailValueEl = document.getElementById("detail-value");
const renderBtn = document.getElementById("render-btn");
const randomBtn = document.getElementById("random-btn");
const zoomInBtn = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const resetViewBtn = document.getElementById("reset-view-btn");
const descEl = document.getElementById("pattern-description");
const listEl = document.getElementById("fractal-list");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("fractal-canvas");
const ctx = canvas.getContext("2d");

const view = {
  zoom: 1,
  panX: 0,
  panY: 0
};

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 30;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let isPinching = false;
let lastPinchDistance = 0;
let lastPinchMidX = 0;
let lastPinchMidY = 0;

function updateCanvasResolution() {
  const pixelRatio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(800, Math.floor(rect.width));
  const height = Math.max(520, Math.floor(rect.height));

  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function resetView() {
  view.zoom = 1;
  view.panX = 0;
  view.panY = 0;
}

function clampZoom(value) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
}

function screenToFractalSpace(screenX, screenY) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  return {
    x: (screenX - w / 2 - view.panX) / view.zoom + w / 2,
    y: (screenY - h / 2 - view.panY) / view.zoom + h / 2
  };
}

function zoomAtPoint(factor, anchorX, anchorY) {
  const before = screenToFractalSpace(anchorX, anchorY);
  view.zoom = clampZoom(view.zoom * factor);
  view.panX = anchorX - canvas.clientWidth / 2 - (before.x - canvas.clientWidth / 2) * view.zoom;
  view.panY = anchorY - canvas.clientHeight / 2 - (before.y - canvas.clientHeight / 2) * view.zoom;
}

function withViewTransform(drawFn) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.save();
  ctx.translate(view.panX, view.panY);
  ctx.translate(w / 2, h / 2);
  ctx.scale(view.zoom, view.zoom);
  ctx.translate(-w / 2, -h / 2);
  drawFn();
  ctx.restore();
}

function getTouchDistance(touchA, touchB) {
  return Math.hypot(touchB.clientX - touchA.clientX, touchB.clientY - touchA.clientY);
}

function getTouchMidpoint(touchA, touchB) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touchA.clientX + touchB.clientX) / 2 - rect.left,
    y: (touchA.clientY + touchB.clientY) / 2 - rect.top
  };
}

function buildUI() {
  const options = fractals.map((f) => `<option value="${f.key}">${f.name}</option>`);
  selectEl.innerHTML = options.join("");

  listEl.innerHTML = fractals
    .map((f, i) => `<li>${i + 1}. ${f.name}</li>`)
    .join("");

  selectEl.value = fractals[0].key;
  applyDetailRange();
  updateDescription();
}

function getActiveFractal() {
  return fractals.find((item) => item.key === selectEl.value) || fractals[0];
}

function applyDetailRange() {
  const fractal = getActiveFractal();
  detailEl.min = String(fractal.detail[0]);
  detailEl.max = String(fractal.detail[1]);
  if (Number(detailEl.value) < fractal.detail[0] || Number(detailEl.value) > fractal.detail[1]) {
    detailEl.value = String(Math.floor((fractal.detail[0] + fractal.detail[1]) / 2));
  }
  detailValueEl.textContent = detailEl.value;
}

function updateDescription() {
  const fractal = getActiveFractal();
  descEl.textContent = fractal.description;
}

function clearCanvas() {
  ctx.fillStyle = "#090b14";
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function drawMandelbrot(detail) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const maxIter = 40 + detail * 30;
  const image = ctx.createImageData(w, h);
  const data = image.data;

  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const sample = screenToFractalSpace(px, py);
      const x0 = (sample.x / w) * 3.5 - 2.5;
      const y0 = (sample.y / h) * 2.4 - 1.2;
      let x = 0;
      let y = 0;
      let iter = 0;

      while (x * x + y * y <= 4 && iter < maxIter) {
        const xt = x * x - y * y + x0;
        y = 2 * x * y + y0;
        x = xt;
        iter += 1;
      }

      const idx = (py * w + px) * 4;
      if (iter === maxIter) {
        data[idx] = 6;
        data[idx + 1] = 10;
        data[idx + 2] = 20;
      } else {
        const hue = (iter / maxIter) * 320;
        const rgb = hsvToRgb(hue, 0.75, 0.95);
        data[idx] = rgb.r;
        data[idx + 1] = rgb.g;
        data[idx + 2] = rgb.b;
      }
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

function drawJulia(detail) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const maxIter = 45 + detail * 28;
  const cRe = -0.79;
  const cIm = 0.15;
  const image = ctx.createImageData(w, h);
  const data = image.data;

  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const sample = screenToFractalSpace(px, py);
      let x = (sample.x / w) * 3 - 1.5;
      let y = (sample.y / h) * 2.2 - 1.1;
      let iter = 0;

      while (x * x + y * y < 4 && iter < maxIter) {
        const xt = x * x - y * y + cRe;
        y = 2 * x * y + cIm;
        x = xt;
        iter += 1;
      }

      const idx = (py * w + px) * 4;
      if (iter === maxIter) {
        data[idx] = 9;
        data[idx + 1] = 8;
        data[idx + 2] = 30;
      } else {
        const hue = 190 + (iter / maxIter) * 160;
        const rgb = hsvToRgb(hue % 360, 0.82, 0.98);
        data[idx] = rgb.r;
        data[idx + 1] = rgb.g;
        data[idx + 2] = rgb.b;
      }
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

function drawNewton(detail) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const maxIter = 12 + detail * 4;
  const roots = [
    { x: 1, y: 0, color: [255, 99, 72] },
    { x: -0.5, y: 0.8660254, color: [36, 255, 167] },
    { x: -0.5, y: -0.8660254, color: [72, 120, 255] }
  ];

  const image = ctx.createImageData(w, h);
  const data = image.data;

  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const sample = screenToFractalSpace(px, py);
      let x = (sample.x / w) * 3 - 1.5;
      let y = (sample.y / h) * 3 - 1.5;
      let iter = 0;

      for (; iter < maxIter; iter += 1) {
        const x2 = x * x;
        const y2 = y * y;
        const x3 = x2 * x - 3 * x * y2;
        const y3 = 3 * x2 * y - y2 * y;

        const fx = x3 - 1;
        const fy = y3;

        const dfx = 3 * (x2 - y2);
        const dfy = 6 * x * y;

        const denom = dfx * dfx + dfy * dfy;
        if (denom === 0) {
          break;
        }

        const rx = (fx * dfx + fy * dfy) / denom;
        const ry = (fy * dfx - fx * dfy) / denom;

        x -= rx;
        y -= ry;

        if (Math.hypot(rx, ry) < 1e-6) {
          break;
        }
      }

      let closest = 0;
      let closestDist = Infinity;
      for (let i = 0; i < roots.length; i += 1) {
        const r = roots[i];
        const d = Math.hypot(x - r.x, y - r.y);
        if (d < closestDist) {
          closestDist = d;
          closest = i;
        }
      }

      const fade = 1 - iter / maxIter;
      const base = roots[closest].color;
      const idx = (py * w + px) * 4;
      data[idx] = Math.round(base[0] * fade);
      data[idx + 1] = Math.round(base[1] * fade);
      data[idx + 2] = Math.round(base[2] * fade);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

function drawSierpinskiTriangle(detail) {
  clearCanvas();
  withViewTransform(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const points = [
      { x: w / 2, y: 36 },
      { x: 32, y: h - 32 },
      { x: w - 32, y: h - 32 }
    ];

    let x = w * 0.37;
    let y = h * 0.22;
    const iterations = 12000 + detail * 22000;

    ctx.fillStyle = "#fcbf49";

    for (let i = 0; i < iterations; i += 1) {
      const p = points[Math.floor(Math.random() * 3)];
      x = (x + p.x) / 2;
      y = (y + p.y) / 2;
      ctx.fillRect(x, y, 1, 1);
    }
  });
}

function drawSierpinskiCarpet(detail) {
  clearCanvas();
  withViewTransform(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const size = Math.min(w, h) - 80;
    const startX = (w - size) / 2;
    const startY = (h - size) / 2;

    ctx.fillStyle = "#fdf0d5";
    ctx.fillRect(startX, startY, size, size);

    ctx.fillStyle = "#003049";

    function carve(x, y, s, depth) {
      if (depth <= 0) {
        return;
      }

      const third = s / 3;
      ctx.fillRect(x + third, y + third, third, third);

      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          if (row === 1 && col === 1) {
            continue;
          }
          carve(x + col * third, y + row * third, third, depth - 1);
        }
      }
    }

    carve(startX, startY, size, detail);
  });
}

function drawKochSnowflake(detail) {
  clearCanvas();
  withViewTransform(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const radius = Math.min(w, h) * 0.32;

    const p1 = { x: w / 2, y: h / 2 - radius };
    const p2 = { x: w / 2 - radius * 0.866, y: h / 2 + radius / 2 };
    const p3 = { x: w / 2 + radius * 0.866, y: h / 2 + radius / 2 };

    let segments = [
      [p1, p2],
      [p2, p3],
      [p3, p1]
    ];

    for (let level = 0; level < detail; level += 1) {
      const next = [];
      for (const [a, b] of segments) {
        const dx = (b.x - a.x) / 3;
        const dy = (b.y - a.y) / 3;
        const pA = { x: a.x + dx, y: a.y + dy };
        const pC = { x: a.x + 2 * dx, y: a.y + 2 * dy };

        const angle = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 3;
        const len = Math.hypot(dx, dy);
        const pB = {
          x: pA.x + Math.cos(angle) * len,
          y: pA.y + Math.sin(angle) * len
        };

        next.push([a, pA], [pA, pB], [pB, pC], [pC, b]);
      }
      segments = next;
    }

    ctx.strokeStyle = "#f77f00";
    ctx.lineWidth = Math.max(0.35, 1.25 / view.zoom);
    ctx.beginPath();
    for (const [a, b] of segments) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  });
}

function drawDragonCurve(detail) {
  clearCanvas();
  withViewTransform(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const iterations = 8 + detail * 2;
    let turns = [1];

    for (let i = 1; i < iterations; i += 1) {
      const revInvert = turns.slice().reverse().map((v) => -v);
      turns = [...turns, 1, ...revInvert];
    }

    const step = Math.max(2, Math.min(w, h) / (40 + detail * 10));
    let x = w * 0.54;
    let y = h * 0.45;
    let angle = 0;

    ctx.strokeStyle = "#eae2b7";
    ctx.lineWidth = Math.max(0.35, 1.1 / view.zoom);
    ctx.beginPath();
    ctx.moveTo(x, y);

    for (const turn of turns) {
      angle += turn * (Math.PI / 2);
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      ctx.lineTo(x, y);
    }

    ctx.stroke();
  });
}

function drawBarnsleyFern(detail) {
  clearCanvas();
  withViewTransform(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const points = 24000 + detail * 22000;
    let x = 0;
    let y = 0;

    ctx.fillStyle = "#80ed99";

    for (let i = 0; i < points; i += 1) {
      const r = Math.random();
      let nextX;
      let nextY;

      if (r < 0.01) {
        nextX = 0;
        nextY = 0.16 * y;
      } else if (r < 0.86) {
        nextX = 0.85 * x + 0.04 * y;
        nextY = -0.04 * x + 0.85 * y + 1.6;
      } else if (r < 0.93) {
        nextX = 0.2 * x - 0.26 * y;
        nextY = 0.23 * x + 0.22 * y + 1.6;
      } else {
        nextX = -0.15 * x + 0.28 * y;
        nextY = 0.26 * x + 0.24 * y + 0.44;
      }

      x = nextX;
      y = nextY;

      const px = Math.round(w / 2 + x * (w / 12));
      const py = Math.round(h - y * (h / 12) - 20);
      ctx.fillRect(px, py, 1, 1);
    }
  });
}

function drawFractalTree(detail) {
  clearCanvas();
  withViewTransform(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.lineCap = "round";

    function branch(x1, y1, length, angle, depth) {
      if (depth <= 0 || length < 2) {
        return;
      }

      const x2 = x1 + Math.cos(angle) * length;
      const y2 = y1 - Math.sin(angle) * length;

      ctx.strokeStyle = `hsl(${95 + depth * 8} 70% ${40 + depth}%)`;
      ctx.lineWidth = Math.max(0.5, (depth * 0.9) / view.zoom);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      branch(x2, y2, length * 0.74, angle + 0.35, depth - 1);
      branch(x2, y2, length * 0.74, angle - 0.35, depth - 1);
    }

    branch(w / 2, h - 24, h * 0.21, Math.PI / 2, detail + 2);
  });
}

function drawCantorSet(detail) {
  clearCanvas();
  withViewTransform(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const levels = detail + 2;
    const rowGap = (h - 80) / levels;

    ctx.fillStyle = "#fcbf49";

    function carve(x, y, width, depth) {
      if (depth <= 0) {
        return;
      }
      ctx.fillRect(x, y, width, Math.max(2, 8 / view.zoom));
      const third = width / 3;
      carve(x, y + rowGap, third, depth - 1);
      carve(x + 2 * third, y + rowGap, third, depth - 1);
    }

    carve(32, 40, w - 64, levels);
  });
}

const drawMap = {
  mandelbrot: drawMandelbrot,
  julia: drawJulia,
  newton: drawNewton,
  "sierpinski-triangle": drawSierpinskiTriangle,
  "sierpinski-carpet": drawSierpinskiCarpet,
  koch: drawKochSnowflake,
  dragon: drawDragonCurve,
  barnsley: drawBarnsleyFern,
  tree: drawFractalTree,
  cantor: drawCantorSet
};

async function renderActiveFractal() {
  const fractal = getActiveFractal();
  const detail = Number(detailEl.value);
  setStatus(`Rendering ${fractal.name} (detail ${detail}, zoom ${view.zoom.toFixed(2)}x)...`);

  await new Promise((resolve) => requestAnimationFrame(resolve));
  clearCanvas();

  const draw = drawMap[fractal.key];
  if (draw) {
    draw(detail);
  }

  setStatus(`Rendered ${fractal.name} | detail ${detail} | zoom ${view.zoom.toFixed(2)}x | pan (${Math.round(view.panX)}, ${Math.round(view.panY)})`);
}

selectEl.addEventListener("change", () => {
  resetView();
  applyDetailRange();
  updateDescription();
  renderActiveFractal();
});

detailEl.addEventListener("input", () => {
  detailValueEl.textContent = detailEl.value;
});

renderBtn.addEventListener("click", renderActiveFractal);

zoomInBtn.addEventListener("click", () => {
  zoomAtPoint(1.2, canvas.clientWidth / 2, canvas.clientHeight / 2);
  renderActiveFractal();
});

zoomOutBtn.addEventListener("click", () => {
  zoomAtPoint(1 / 1.2, canvas.clientWidth / 2, canvas.clientHeight / 2);
  renderActiveFractal();
});

resetViewBtn.addEventListener("click", () => {
  resetView();
  renderActiveFractal();
});

randomBtn.addEventListener("click", () => {
  const idx = Math.floor(Math.random() * fractals.length);
  selectEl.value = fractals[idx].key;
  resetView();
  applyDetailRange();
  updateDescription();
  renderActiveFractal();
});

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  zoomAtPoint(factor, x, y);
  renderActiveFractal();
}, { passive: false });

canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 0) {
    return;
  }
  isPanning = true;
  panStartX = event.clientX;
  panStartY = event.clientY;
  canvas.classList.add("is-panning");
});

window.addEventListener("mousemove", (event) => {
  if (!isPanning) {
    return;
  }
  const dx = event.clientX - panStartX;
  const dy = event.clientY - panStartY;
  view.panX += dx;
  view.panY += dy;
  panStartX = event.clientX;
  panStartY = event.clientY;
  renderActiveFractal();
});

window.addEventListener("mouseup", () => {
  isPanning = false;
  canvas.classList.remove("is-panning");
});

canvas.addEventListener("mouseleave", () => {
  if (!isPanning) {
    return;
  }
  isPanning = false;
  canvas.classList.remove("is-panning");
});

canvas.addEventListener("touchstart", (event) => {
  if (event.touches.length === 1) {
    isPinching = false;
    isPanning = true;
    panStartX = event.touches[0].clientX;
    panStartY = event.touches[0].clientY;
    canvas.classList.add("is-panning");
  } else if (event.touches.length === 2) {
    isPanning = false;
    canvas.classList.remove("is-panning");
    isPinching = true;
    lastPinchDistance = getTouchDistance(event.touches[0], event.touches[1]);
    const midpoint = getTouchMidpoint(event.touches[0], event.touches[1]);
    lastPinchMidX = midpoint.x;
    lastPinchMidY = midpoint.y;
  }
}, { passive: true });

canvas.addEventListener("touchmove", (event) => {
  if (event.touches.length === 1 && isPanning && !isPinching) {
    event.preventDefault();
    const touch = event.touches[0];
    const dx = touch.clientX - panStartX;
    const dy = touch.clientY - panStartY;
    view.panX += dx;
    view.panY += dy;
    panStartX = touch.clientX;
    panStartY = touch.clientY;
    renderActiveFractal();
    return;
  }

  if (event.touches.length === 2) {
    event.preventDefault();
    const distance = getTouchDistance(event.touches[0], event.touches[1]);
    if (!isPinching) {
      isPinching = true;
      lastPinchDistance = distance;
    }

    const midpoint = getTouchMidpoint(event.touches[0], event.touches[1]);
    view.panX += midpoint.x - lastPinchMidX;
    view.panY += midpoint.y - lastPinchMidY;

    if (lastPinchDistance > 0) {
      const factor = distance / lastPinchDistance;
      zoomAtPoint(factor, midpoint.x, midpoint.y);
    }

    lastPinchDistance = distance;
    lastPinchMidX = midpoint.x;
    lastPinchMidY = midpoint.y;
    renderActiveFractal();
  }
}, { passive: false });

function endTouchInteraction(event) {
  if (event.touches.length === 1) {
    isPinching = false;
    isPanning = true;
    panStartX = event.touches[0].clientX;
    panStartY = event.touches[0].clientY;
    canvas.classList.add("is-panning");
    return;
  }

  if (event.touches.length === 0) {
    isPanning = false;
    isPinching = false;
    canvas.classList.remove("is-panning");
  }
}

canvas.addEventListener("touchend", endTouchInteraction);
canvas.addEventListener("touchcancel", endTouchInteraction);

window.addEventListener("resize", () => {
  updateCanvasResolution();
  renderActiveFractal();
});

buildUI();
resetView();
updateCanvasResolution();
renderActiveFractal();
