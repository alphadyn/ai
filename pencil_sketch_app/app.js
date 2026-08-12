const fileInput = document.getElementById('fileInput');
const modeSelect = document.getElementById('modeSelect');
const accuracyRange = document.getElementById('accuracyRange');
const accuracyValue = document.getElementById('accuracyValue');
const strokeLengthRange = document.getElementById('strokeLengthRange');
const strokeLengthValue = document.getElementById('strokeLengthValue');
const colorBlurRange = document.getElementById('colorBlurRange');
const colorBlurValue = document.getElementById('colorBlurValue');
const brightnessRange = document.getElementById('brightnessRange');
const brightnessValue = document.getElementById('brightnessValue');
const colorTintInput = document.getElementById('colorTintInput');
const colorTintValue = document.getElementById('colorTintValue');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusText = document.getElementById('status');

const originalCanvas = document.getElementById('originalCanvas');
const sketchCanvas = document.getElementById('sketchCanvas');
const originalCtx = originalCanvas.getContext('2d');
const sketchCtx = sketchCanvas.getContext('2d');

let currentImage = null;

function clampByte(value) {
  return Math.min(255, Math.max(0, value));
}

function getGrayChannel(data) {
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return gray;
}

function invertChannel(channel) {
  const inverted = new Uint8ClampedArray(channel.length);
  for (let i = 0; i < channel.length; i += 1) {
    inverted[i] = 255 - channel[i];
  }
  return inverted;
}

function boxBlurChannel(channel, width, height, radius) {
  if (radius <= 0) {
    return new Uint8ClampedArray(channel);
  }

  const horizontalPass = new Uint8ClampedArray(channel.length);
  const output = new Uint8ClampedArray(channel.length);
  const kernelSize = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const sampleX = Math.min(width - 1, Math.max(0, x + k));
        sum += channel[rowStart + sampleX];
      }
      horizontalPass[rowStart + x] = Math.round(sum / kernelSize);
    }
  }

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const sampleY = Math.min(height - 1, Math.max(0, y + k));
        sum += horizontalPass[sampleY * width + x];
      }
      output[y * width + x] = Math.round(sum / kernelSize);
    }
  }

  return output;
}

function colorDodgeBlend(grayValue, blurredInvertedValue) {
  if (blurredInvertedValue >= 255) {
    return 255;
  }

  return clampByte(Math.round((grayValue * 256) / (255 - blurredInvertedValue)));
}

function hexToRgb(hexColor) {
  const clean = hexColor.replace('#', '');
  const expanded = clean.length === 3
    ? clean.split('').map((ch) => ch + ch).join('')
    : clean;

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16)
  };
}

function updateLabels() {
  accuracyValue.textContent = `${accuracyRange.value}%`;
  strokeLengthValue.textContent = `${strokeLengthRange.value}%`;
  colorBlurValue.textContent = `${colorBlurRange.value}%`;
  brightnessValue.textContent = `${brightnessRange.value}%`;
  colorTintValue.textContent = colorTintInput.value.toUpperCase();
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
  const colorBlurLevel = Number(colorBlurRange.value) / 100;
  const brightness = Number(brightnessRange.value) / 100;
  const tint = hexToRgb(colorTintInput.value);
  const tintR = tint.r / 255;
  const tintG = tint.g / 255;
  const tintB = tint.b / 255;

  const gray = getGrayChannel(sourceData);
  const invertedGray = invertChannel(gray);
  const blurRadius = Math.max(2, Math.round(6 + strokeLength * 32));
  const blurredInverted = boxBlurChannel(invertedGray, width, height, blurRadius);
  const colorBlurBoostRadius = Math.max(1, Math.round(1 + colorBlurLevel * 30));
  const colorBlurredInverted = mode === 'color'
    ? boxBlurChannel(blurredInverted, width, height, colorBlurBoostRadius)
    : blurredInverted;
  const brightnessScale = 0.45 + brightness * 1.5;
  const colorSourceMix = 0.04 + accuracy * 0.28;
  const colorSaturation = 0.12 + accuracy * 0.24;
  const paperBlend = 0.2 + strokeLength * 0.22;

  for (let px = 0, i = 0; i < sourceData.length; i += 4, px += 1) {
    const blurSource = mode === 'color' ? colorBlurredInverted : blurredInverted;
    const sketchTone = colorDodgeBlend(gray[px], blurSource[px]);

    if (mode === 'bw') {
      const value = clampByte(Math.round(sketchTone * brightnessScale));
      outputData[i] = value;
      outputData[i + 1] = value;
      outputData[i + 2] = value;
      outputData[i + 3] = 255;
      continue;
    }

    const r = sourceData[i];
    const g = sourceData[i + 1];
    const b = sourceData[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const desatR = luminance + (r - luminance) * colorSaturation;
    const desatG = luminance + (g - luminance) * colorSaturation;
    const desatB = luminance + (b - luminance) * colorSaturation;

    const sketchBase = sketchTone / 255;
    const pencilShade = Math.pow(sketchBase, 1.34);
    const linePressure = 0.85 + (1 - accuracy) * 0.45;
    const shadowScale = 1 - (1 - pencilShade) * linePressure;

    const x = px % width;
    const y = Math.floor(px / width);
    const hatchA = Math.sin(x * 0.19 + y * 0.11);
    const hatchB = Math.sin(x * -0.13 + y * 0.23);
    const hatchC = Math.sin(x * 0.08 + y * 0.31);
    const hatchMix = hatchA * 0.5 + hatchB * 0.35 + hatchC * 0.15;
    const midtoneMask = Math.max(0, 1 - Math.abs(sketchBase - 0.55) * 1.7);
    const hatchStrength = ((1 - accuracy) * 0.28 + strokeLength * 0.16) * midtoneMask;
    const hatchShade = 1 - Math.max(0, hatchMix) * hatchStrength;

    const grainSeed = ((x * 73856093) ^ (y * 19349663)) & 255;
    const grain = grainSeed / 255 - 0.5;
    const grainAmount = (1 - accuracy) * 0.12 + 0.05;
    const grainShade = 1 - grain * grainAmount;
    const texturedShade = Math.max(0, Math.min(1.2, shadowScale * hatchShade * grainShade));

    const tintRedScale = 0.25 + tintR * 0.9;
    const tintGreenScale = 0.25 + tintG * 0.9;
    const tintBlueScale = 0.25 + tintB * 0.9;

    const redSketch = desatR * texturedShade * tintRedScale;
    const greenSketch = desatG * texturedShade * tintGreenScale;
    const blueSketch = desatB * texturedShade * tintBlueScale;

    const warmPaperR = 247;
    const warmPaperG = 242;
    const warmPaperB = 231;

    const paperRed = redSketch * (1 - paperBlend) + warmPaperR * paperBlend;
    const paperGreen = greenSketch * (1 - paperBlend) + warmPaperG * paperBlend;
    const paperBlue = blueSketch * (1 - paperBlend) + warmPaperB * paperBlend;

    const mixedRed = paperRed * (1 - colorSourceMix) + r * colorSourceMix;
    const mixedGreen = paperGreen * (1 - colorSourceMix) + g * colorSourceMix;
    const mixedBlue = paperBlue * (1 - colorSourceMix) + b * colorSourceMix;

    outputData[i] = clampByte(Math.round(mixedRed * brightnessScale));
    outputData[i + 1] = clampByte(Math.round(mixedGreen * brightnessScale));
    outputData[i + 2] = clampByte(Math.round(mixedBlue * brightnessScale));
    outputData[i + 3] = 255;
  }

  sketchCanvas.width = width;
  sketchCanvas.height = height;
  sketchCtx.putImageData(output, 0, 0);
  setStatus(mode === 'bw'
    ? `Black-and-white pencil sketch generated at ${accuracyRange.value}% accuracy, ${strokeLengthRange.value}% stroke length, ${brightnessRange.value}% brightness.`
    : `Color pencil sketch generated at ${accuracyRange.value}% accuracy, ${strokeLengthRange.value}% stroke length, ${colorBlurRange.value}% blurriness, ${brightnessRange.value}% brightness, tint ${colorTintInput.value.toUpperCase()}.`);
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
colorBlurRange.addEventListener('input', () => {
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
colorTintInput.addEventListener('input', () => {
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
