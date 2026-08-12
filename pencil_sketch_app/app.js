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

  const gray = getGrayChannel(sourceData);
  const invertedGray = invertChannel(gray);
  const blurRadius = Math.max(1, Math.round(2 + strokeLength * 22));
  const blurredInverted = boxBlurChannel(invertedGray, width, height, blurRadius);
  const brightnessScale = 0.45 + brightness * 1.5;
  const sourceMix = accuracy;

  for (let px = 0, i = 0; i < sourceData.length; i += 4, px += 1) {
    const sketchTone = colorDodgeBlend(gray[px], blurredInverted[px]);

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
    const sketchBase = sketchTone / 255;

    const redSketch = clampByte(Math.round((r * sketchBase * redIntensity)));
    const greenSketch = clampByte(Math.round((g * sketchBase * greenIntensity)));
    const blueSketch = clampByte(Math.round((b * sketchBase * blueIntensity)));

    const mixedRed = redSketch * (1 - sourceMix) + r * sourceMix;
    const mixedGreen = greenSketch * (1 - sourceMix) + g * sourceMix;
    const mixedBlue = blueSketch * (1 - sourceMix) + b * sourceMix;

    outputData[i] = clampByte(Math.round(mixedRed * brightnessScale));
    outputData[i + 1] = clampByte(Math.round(mixedGreen * brightnessScale));
    outputData[i + 2] = clampByte(Math.round(mixedBlue * brightnessScale));
    outputData[i + 3] = 255;
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
