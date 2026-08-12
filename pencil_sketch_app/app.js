const fileInput = document.getElementById('fileInput');
const modeSelect = document.getElementById('modeSelect');
const accuracyRange = document.getElementById('accuracyRange');
const accuracyValue = document.getElementById('accuracyValue');
const strokeLengthRange = document.getElementById('strokeLengthRange');
const strokeLengthValue = document.getElementById('strokeLengthValue');
const brightnessRange = document.getElementById('brightnessRange');
const brightnessValue = document.getElementById('brightnessValue');
const redFilterRange = document.getElementById('redFilterRange');
const redFilterValue = document.getElementById('redFilterValue');
const greenFilterRange = document.getElementById('greenFilterRange');
const greenFilterValue = document.getElementById('greenFilterValue');
const blueFilterRange = document.getElementById('blueFilterRange');
const blueFilterValue = document.getElementById('blueFilterValue');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusText = document.getElementById('status');

const originalCanvas = document.getElementById('originalCanvas');
const sketchCanvas = document.getElementById('sketchCanvas');
const originalCtx = originalCanvas.getContext('2d');
const sketchCtx = sketchCanvas.getContext('2d');

let currentImage = null;

function updateLabels() {
  accuracyValue.textContent = `${accuracyRange.value}%`;
  strokeLengthValue.textContent = `${strokeLengthRange.value}%`;
  brightnessValue.textContent = `${brightnessRange.value}%`;
  redFilterValue.textContent = `${redFilterRange.value}%`;
  greenFilterValue.textContent = `${greenFilterRange.value}%`;
  blueFilterValue.textContent = `${blueFilterRange.value}%`;
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? '#fca5a5' : '#a7f3d0';
}

function renderImageToCanvas(canvas, context, image) {
  const maxSize = 900;
  const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
}

function generateSketch() {
  if (!currentImage) {
    setStatus('Please upload an image first.', true);
    return;
  }

  const width = originalCanvas.width;
  const height = originalCanvas.height;
  const source = originalCtx.getImageData(0, 0, width, height);
  const output = new ImageData(width, height);
  const sourceData = source.data;
  const outputData = output.data;
  const mode = modeSelect.value;
  const accuracy = Number(accuracyRange.value) / 100;
  const strokeLength = Number(strokeLengthRange.value) / 100;
  const brightness = Number(brightnessRange.value) / 100;
  const redIntensity = Number(redFilterRange.value) / 100;
  const greenIntensity = Number(greenFilterRange.value) / 100;
  const blueIntensity = Number(blueFilterRange.value) / 100;

  for (let i = 0; i < sourceData.length; i += 4) {
    const r = sourceData[i];
    const g = sourceData[i + 1];
    const b = sourceData[i + 2];
    const gray = (r + g + b) / 3;
    const inverted = 255 - gray;
    const softLine = Math.min(255, Math.max(0, inverted * 1.2));
    const textureScale = 0.5 + strokeLength * 4.2;
    const texture = Math.sin((i / 4) * (0.07 + strokeLength * 0.15)) * 0.5 + 0.5;
    const grain = (texture - 0.5) * (12 + (1 - strokeLength) * 32);
    const brightnessScale = 0.45 + brightness * 1.5;

    if (mode === 'bw') {
      const detailRetention = 0.35 + accuracy * 0.9;
      const contourBoost = 0.8 + (1 - accuracy) * 1.3;
      const value = 255 - (gray * detailRetention + softLine * contourBoost + grain * (0.7 + strokeLength));
      const tone = Math.min(255, Math.max(0, value * brightnessScale));
      outputData[i] = tone;
      outputData[i + 1] = tone;
      outputData[i + 2] = tone;
      outputData[i + 3] = 255;
    } else {
      const warmR = Math.min(255, (255 - r) * 0.75 + 40);
      const warmG = Math.min(255, (255 - g) * 0.72 + 25);
      const warmB = Math.min(255, (255 - b) * 0.82 + 30);
      const paperLight = (softLine + 0.6 * gray) / 1.6;
      const inheritedMix = 0.15 + accuracy * 0.75;
      const pencilMix = 1 - inheritedMix;
      const textureBlend = 0.25 + strokeLength * 0.8;
      const redTarget = r * inheritedMix + warmR * pencilMix + paperLight * (0.7 + (1 - accuracy) * 0.5) + grain * textureBlend;
      const greenTarget = g * inheritedMix + warmG * pencilMix + paperLight * (0.7 + (1 - accuracy) * 0.5) + grain * textureBlend;
      const blueTarget = b * inheritedMix + warmB * pencilMix + paperLight * (0.7 + (1 - accuracy) * 0.5) + grain * textureBlend;

      const red = Math.min(255, Math.max(0, Math.round(redTarget * redIntensity * brightnessScale)));
      const green = Math.min(255, Math.max(0, Math.round(greenTarget * greenIntensity * brightnessScale)));
      const blue = Math.min(255, Math.max(0, Math.round(blueTarget * blueIntensity * brightnessScale)));

      outputData[i] = red;
      outputData[i + 1] = green;
      outputData[i + 2] = blue;
      outputData[i + 3] = 255;
    }
  }

  sketchCanvas.width = width;
  sketchCanvas.height = height;
  sketchCtx.putImageData(output, 0, 0);
  setStatus(mode === 'bw'
    ? `Black-and-white pencil sketch generated at ${accuracyRange.value}% accuracy, ${strokeLengthRange.value}% stroke length, ${brightnessRange.value}% brightness, red ${redFilterRange.value}%, green ${greenFilterRange.value}%, blue ${blueFilterRange.value}%.`
    : `Color pencil sketch generated at ${accuracyRange.value}% accuracy, ${strokeLengthRange.value}% stroke length, ${brightnessRange.value}% brightness, red ${redFilterRange.value}%, green ${greenFilterRange.value}%, blue ${blueFilterRange.value}%.`);
}

function handleFileSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    setStatus('Please choose a valid image file.', true);
    return;
  }

  const reader = new FileReader();
  reader.onload = (readEvent) => {
    const image = new Image();
    image.onload = () => {
      currentImage = image;
      renderImageToCanvas(originalCanvas, originalCtx, image);
      generateSketch();
      setStatus(`Loaded ${file.name}.`);
    };
    image.onerror = () => {
      setStatus('The selected image could not be read.', true);
    };
    image.src = readEvent.target.result;
  };

  reader.readAsDataURL(file);
}

fileInput.addEventListener('change', handleFileSelection);
accuracyRange.addEventListener('input', () => {
  updateLabels();
  if (currentImage) {
    generateSketch();
  }
});
strokeLengthRange.addEventListener('input', () => {
  updateLabels();
  if (currentImage) {
    generateSketch();
  }
});
brightnessRange.addEventListener('input', () => {
  updateLabels();
  if (currentImage) {
    generateSketch();
  }
});
redFilterRange.addEventListener('input', () => {
  updateLabels();
  if (currentImage) {
    generateSketch();
  }
});
greenFilterRange.addEventListener('input', () => {
  updateLabels();
  if (currentImage) {
    generateSketch();
  }
});
blueFilterRange.addEventListener('input', () => {
  updateLabels();
  if (currentImage) {
    generateSketch();
  }
});
generateBtn.addEventListener('click', generateSketch);
modeSelect.addEventListener('change', () => {
  if (currentImage) {
    generateSketch();
  }
});

downloadBtn.addEventListener('click', () => {
  if (!currentImage) {
    setStatus('Generate a sketch before downloading.', true);
    return;
  }

  const link = document.createElement('a');
  link.download = 'pencil-sketch.png';
  link.href = sketchCanvas.toDataURL('image/png');
  link.click();
});

updateLabels();
