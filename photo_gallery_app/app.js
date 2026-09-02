const PHOTO_COUNT = 10;
const IMAGE_SOURCE = "https://picsum.photos"; // random photos, new set fetched on every page load

// Fresh random seeds each load so a new set of photos is fetched from the web on every refresh
function buildPhotoList() {
  const photos = [];
  for (let i = 1; i <= PHOTO_COUNT; i++) {
    const seed = `${Date.now()}-${Math.floor(Math.random() * 1000000)}-${i}`;
    photos.push({
      src: `${IMAGE_SOURCE}/seed/${seed}/1200/800`,
      caption: `Photo ${i} of ${PHOTO_COUNT}`,
    });
  }
  return photos;
}

const PHOTOS = buildPhotoList();

const ROTATE_INTERVAL_MS = 4000;

const track = document.getElementById("carousel-track");
const thumbnails = document.getElementById("thumbnails");
const caption = document.getElementById("caption");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const playBtn = document.getElementById("play-btn");
const progressFill = document.getElementById("progress-fill");
const carousel = document.getElementById("carousel");
const maximizeBtn = document.getElementById("maximize-btn");
const fullscreenModal = document.getElementById("fullscreen-modal");
const fullscreenImg = document.getElementById("fullscreen-img");
const closeModalBtn = document.getElementById("close-modal-btn");
const fullscreenCaption = document.getElementById("fullscreen-caption");

let current = 0;
let playing = true;
let timerId = null;
let progressStart = null;
let swipeStartX = 0;
let swipeStartY = 0;
let wasPlayingBeforeMaximize = true;
const SWIPE_THRESHOLD = 50;

function handleSwipeStart(clientX, clientY) {
  swipeStartX = clientX;
  swipeStartY = clientY;
}

function handleSwipeEnd(clientX, clientY) {
  const deltaX = clientX - swipeStartX;
  const deltaY = clientY - swipeStartY;

  if (Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) {
    return;
  }

  // If vertical swipe is more significant than horizontal, don't handle
  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    return;
  }

  if (deltaX < 0) {
    next();
  } else {
    prev();
  }
}

function handleFullscreenSwipeStart(clientX, clientY) {
  swipeStartX = clientX;
  swipeStartY = clientY;
}

function handleFullscreenSwipeEnd(clientX, clientY) {
  const deltaX = clientX - swipeStartX;
  const deltaY = clientY - swipeStartY;

  if (Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) {
    return;
  }

  // Vertical swipe (up or down) closes the modal
  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    closeMaximized();
    return;
  }

  // Horizontal swipe navigates through photos
  if (deltaX < 0) {
    next();
    updateFullscreenImage();
  } else {
    prev();
    updateFullscreenImage();
  }
}

function buildSlides() {
  PHOTOS.forEach((photo, index) => {
    const slide = document.createElement("div");
    slide.className = "slide" + (index === 0 ? " active" : "");
    slide.dataset.index = String(index);

    const img = document.createElement("img");
    img.src = photo.src;
    img.alt = photo.caption;
    img.loading = index === 0 ? "eager" : "lazy";

    slide.appendChild(img);
    track.appendChild(slide);

    const thumb = document.createElement("button");
    thumb.className = "thumb" + (index === 0 ? " active" : "");
    thumb.setAttribute("aria-label", `Go to ${photo.caption}`);
    const thumbImg = document.createElement("img");
    thumbImg.src = photo.src;
    thumbImg.alt = "";
    thumb.appendChild(thumbImg);
    thumb.addEventListener("click", () => goTo(index));
    thumbnails.appendChild(thumb);
  });
}

function render() {
  document.querySelectorAll(".slide").forEach((slide, index) => {
    slide.classList.toggle("active", index === current);
  });
  document.querySelectorAll(".thumb").forEach((thumb, index) => {
    thumb.classList.toggle("active", index === current);
  });
  caption.textContent = PHOTOS[current].caption;
}

function goTo(index) {
  current = (index + PHOTOS.length) % PHOTOS.length;
  render();
  restartTimer();
}

function next() {
  goTo(current + 1);
}

function prev() {
  goTo(current - 1);
}

function restartTimer() {
  clearInterval(timerId);
  timerId = null;
  progressStart = null;
  if (playing) {
    startTimer();
  } else {
    progressFill.style.width = "0%";
  }
}

function startTimer() {
  progressStart = performance.now();
  timerId = setInterval(() => {
    const elapsed = performance.now() - progressStart;
    const pct = Math.min(100, (elapsed / ROTATE_INTERVAL_MS) * 100);
    progressFill.style.width = pct + "%";
    if (elapsed >= ROTATE_INTERVAL_MS) {
      current = (current + 1) % PHOTOS.length;
      render();
      progressStart = performance.now();
    }
  }, 50);
}

function togglePlay() {
  playing = !playing;
  playBtn.innerHTML = playing ? "&#10073;&#10073;" : "&#9654;";
  playBtn.setAttribute("aria-label", playing ? "Pause rotation" : "Play rotation");
  restartTimer();
}

function openMaximized() {
  wasPlayingBeforeMaximize = playing;
  if (playing) {
    togglePlay();
  }
  fullscreenImg.src = PHOTOS[current].src;
  fullscreenCaption.textContent = PHOTOS[current].caption;
  fullscreenModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function updateFullscreenImage() {
  fullscreenImg.src = PHOTOS[current].src;
  fullscreenCaption.textContent = PHOTOS[current].caption;
}

function closeMaximized() {
  fullscreenModal.classList.remove("active");
  document.body.style.overflow = "auto";
  if (wasPlayingBeforeMaximize && !playing) {
    togglePlay();
  }
}

prevBtn.addEventListener("click", prev);
nextBtn.addEventListener("click", next);
playBtn.addEventListener("click", togglePlay);
maximizeBtn.addEventListener("click", openMaximized);
closeModalBtn.addEventListener("click", closeMaximized);

fullscreenModal.addEventListener("click", (event) => {
  if (event.target === fullscreenModal) {
    closeMaximized();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && fullscreenModal.classList.contains("active")) {
    closeMaximized();
  }
});

carousel.addEventListener(
  "pointerdown",
  (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    handleSwipeStart(event.clientX, event.clientY);
  },
  { passive: true }
);

carousel.addEventListener(
  "pointerup",
  (event) => {
    handleSwipeEnd(event.clientX, event.clientY);
  },
  { passive: true }
);

carousel.addEventListener(
  "touchstart",
  (event) => {
    const touch = event.changedTouches[0];
    if (touch) {
      handleSwipeStart(touch.clientX, touch.clientY);
    }
  },
  { passive: true }
);

carousel.addEventListener(
  "touchend",
  (event) => {
    const touch = event.changedTouches[0];
    if (touch) {
      handleSwipeEnd(touch.clientX, touch.clientY);
    }
  },
  { passive: true }
);

// Fullscreen modal swipe handlers
fullscreenModal.addEventListener(
  "pointerdown",
  (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    handleFullscreenSwipeStart(event.clientX, event.clientY);
  },
  { passive: true }
);

fullscreenModal.addEventListener(
  "pointerup",
  (event) => {
    handleFullscreenSwipeEnd(event.clientX, event.clientY);
  },
  { passive: true }
);

fullscreenModal.addEventListener(
  "touchstart",
  (event) => {
    const touch = event.changedTouches[0];
    if (touch) {
      handleFullscreenSwipeStart(touch.clientX, touch.clientY);
    }
  },
  { passive: true }
);

fullscreenModal.addEventListener(
  "touchend",
  (event) => {
    const touch = event.changedTouches[0];
    if (touch) {
      handleFullscreenSwipeEnd(touch.clientX, touch.clientY);
    }
  },
  { passive: true }
);

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") prev();
  if (event.key === "ArrowRight") next();
});

buildSlides();
render();
startTimer();
