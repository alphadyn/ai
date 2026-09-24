const STORAGE_KEY = "checkin-map-app:checkins";
const MAX_CHECKINS = 10;
const MAX_MEDIA_FILES = 5;
const MAX_MEDIA_SIZE = 5 * 1024 * 1024;

const checkInForm = document.getElementById("checkInForm");
const locationInput = document.getElementById("locationInput");
const checkInBtn = document.getElementById("checkInBtn");
const checkInStatus = document.getElementById("checkInStatus");
const checkInListEl = document.getElementById("checkInList");
const clearCheckInsBtn = document.getElementById("clearCheckInsBtn");
const photoInput = document.getElementById("photoInput");
const photoStatus = document.getElementById("photoStatus");
const photoListEl = document.getElementById("photoList");

const mapElement = document.getElementById("map");
const worldFitZoom = Math.max(
  0,
  Math.min(Math.log2(mapElement.clientWidth / 256), Math.log2(mapElement.clientHeight / 256)) - 0.05
);
const map = L.map("map", { minZoom: worldFitZoom }).setView([0, 0], worldFitZoom);
// OpenStreetMap's own tile servers block requests from most referers/origins that
// aren't a registered production site (see https://wiki.openstreetmap.org/wiki/Blocked_tiles).
// CARTO's free basemap tiles are built from OSM data and don't apply that restriction.
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2w0f_1_82cba88eb21776b6335fa821", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19,
  noWrap: true,
}).addTo(map);

const worldViewControl = L.control({ position: "topleft" });
worldViewControl.onAdd = () => {
  const button = L.DomUtil.create("button", "world-view-btn");
  button.type = "button";
  button.title = "Zoom all the way out";
  button.setAttribute("aria-label", "Zoom all the way out");
  button.textContent = "🌐";
  L.DomEvent.disableClickPropagation(button);
  L.DomEvent.on(button, "click", () => map.setView([0, 0], map.getMinZoom()));
  return button;
};
worldViewControl.addTo(map);
map.zoomControl.remove();
map.zoomControl.addTo(map);

const checkInLayer = L.layerGroup().addTo(map);

let checkIns = loadCheckIns();
let photoMarkers = [];
let swipeStartX = null;
let suppressNextListClick = false;

function loadCheckIns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeCheckIn) : [];
  } catch {
    return [];
  }
}

function createId() {
  return window.crypto?.randomUUID?.() || `checkin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeCheckIn(checkIn) {
  return {
    ...checkIn,
    id: checkIn.id || createId(),
    media: Array.isArray(checkIn.media) ? checkIn.media : [],
  };
}

function saveCheckIns() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checkIns));
}

function updateClearCheckInsButton() {
  clearCheckInsBtn.disabled = checkIns.length === 0;
}

function addCheckIn(checkIn) {
  checkIns.unshift(checkIn);
  checkIns = checkIns.slice(0, MAX_CHECKINS);
  saveCheckIns();
  renderCheckInList();
  renderCheckInMarkers();
  updateClearCheckInsButton();
}

function setStatus(el, message, kind) {
  el.textContent = message;
  el.classList.remove("error", "success");
  if (kind) el.classList.add(kind);
}

function formatTimestamp(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function geocodeLocation(query) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&limit=1`,
    { headers: { Accept: "application/json" } }
  );
  if (!response.ok) throw new Error("location lookup failed");
  const results = await response.json();
  if (results.length === 0) throw new Error(`No known location found for "${query}".`);
  const [result] = results;
  return { lat: parseFloat(result.lat), lon: parseFloat(result.lon), label: formatLocationLabel(result.address, result.display_name) };
}

async function reverseGeocodeLocation(lat, lon) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lon}`,
    { headers: { Accept: "application/json" } }
  );
  if (!response.ok) throw new Error("location lookup failed");
  const result = await response.json();
  return formatLocationLabel(result.address, result.display_name);
}

function formatLocationLabel(address = {}, fallback = "Map point") {
  const city = address.city || address.town || address.village || address.municipality || address.county;
  return [city, address.state, address.country].filter(Boolean).join(", ") || fallback;
}

function renderCheckInList() {
  if (checkIns.length === 0) {
    checkInListEl.innerHTML = '<li class="empty-state">No check-ins yet.</li>';
    updateClearCheckInsButton();
    return;
  }
  checkInListEl.innerHTML = checkIns
    .map(
      (checkIn, index) => `
        <li class="checkin-entry" data-checkin-index="${index}" role="button" tabindex="0">
          ${checkIn.previewUrl ? `<img class="checkin-preview" src="${escapeHtml(checkIn.previewUrl)}" alt="${escapeHtml(checkIn.label)}" />` : ""}
          <div>
            <p class="checkin-title">${checkIn.type === "photo" ? "Photo: " : ""}${escapeHtml(checkIn.label)}</p>
            <p class="checkin-meta">${checkIn.lat.toFixed(4)}, ${checkIn.lon.toFixed(4)} &middot; ${formatTimestamp(checkIn.timestamp)}</p>
            ${renderAttachedMedia(checkIn)}
            <label class="attach-media-btn" data-stop-map-click="true">
              <span>Attach media</span>
              <input class="media-input" type="file" accept="image/*,video/*,audio/*" multiple data-checkin-index="${index}" />
            </label>
          </div>
          <button type="button" class="delete-checkin-btn" data-delete-index="${index}" data-stop-map-click="true" aria-label="Delete ${escapeHtml(checkIn.label)}" title="Delete check-in">&times;</button>
        </li>`
    )
    .join("");
  updateClearCheckInsButton();
}

function clearAllCheckIns() {
  if (!checkIns.length || !window.confirm("Remove all check-ins and their attached media?")) return;
  checkIns = [];
  saveCheckIns();
  renderCheckInList();
  renderCheckInMarkers();
  setStatus(checkInStatus, "All check-ins removed.", "success");
}

function deleteCheckIn(index) {
  const checkIn = checkIns[index];
  if (!checkIn || !window.confirm(`Delete the check-in for ${checkIn.label}?`)) return;
  checkIns.splice(index, 1);
  saveCheckIns();
  renderCheckInList();
  renderCheckInMarkers();
  setStatus(checkInStatus, "Check-in deleted.", "success");
}

function deleteCheckInById(id) {
  const index = checkIns.findIndex((checkIn) => checkIn.id === id);
  if (index !== -1) deleteCheckIn(index);
}

function renderAttachedMedia(checkIn) {
  if (!checkIn.media.length) return "";
  return `<div class="attached-media">${checkIn.media
    .map((media) => {
      if (media.type.startsWith("image/")) {
        return `<img class="attached-media-preview" src="${escapeHtml(media.dataUrl)}" alt="${escapeHtml(media.name)}" title="${escapeHtml(media.name)}" />`;
      }
      return `<a class="attached-media-link" href="${escapeHtml(media.dataUrl)}" target="_blank" rel="noopener">${escapeHtml(media.name)}</a>`;
    })
    .join("")}</div>`;
}

function centerMapOnCheckIn(index) {
  const checkIn = checkIns[index];
  if (checkIn) map.setView([checkIn.lat, checkIn.lon], 12);
}

function handleCheckInListInteraction(event) {
  if (event.target.closest("[data-stop-map-click]")) return;
  if (suppressNextListClick && event.type === "click") {
    suppressNextListClick = false;
    return;
  }
  const entry = event.target.closest("[data-checkin-index]");
  if (!entry) return;

  if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
  if (event.type === "keydown") event.preventDefault();
  centerMapOnCheckIn(Number(entry.dataset.checkinIndex));
}

function handleCheckInListAction(event) {
  const deleteButton = event.target.closest("[data-delete-index]");
  if (!deleteButton) return;
  event.preventDefault();
  event.stopPropagation();
  deleteCheckIn(Number(deleteButton.dataset.deleteIndex));
}

function handleCheckInTouchStart(event) {
  if (event.touches.length === 1) swipeStartX = event.touches[0].clientX;
}

function handleCheckInTouchEnd(event) {
  if (swipeStartX === null) return;
  const endX = event.changedTouches[0]?.clientX ?? swipeStartX;
  const entry = event.target.closest("[data-checkin-index]");
  const distance = endX - swipeStartX;
  swipeStartX = null;
  if (entry && distance < -70) {
    suppressNextListClick = true;
    deleteCheckIn(Number(entry.dataset.checkinIndex));
  }
}

async function createMapCheckIn(lat, lng) {
  setStatus(checkInStatus, "Finding the nearest city…");
  let label;
  try {
    label = await reverseGeocodeLocation(lat, lng);
  } catch {
    label = `Map point (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
  addCheckIn({
    id: createId(),
    lat,
    lon: lng,
    label,
    timestamp: new Date().toISOString(),
    type: "location",
    media: [],
  });
  setStatus(checkInStatus, `Checked in at ${label}.`, "success");
}

function handleMapContextMenu(event) {
  L.popup()
    .setLatLng(event.latlng)
    .setContent(`<button type="button" class="drop-pin-btn" data-drop-pin-lat="${event.latlng.lat}" data-drop-pin-lng="${event.latlng.lng}">Drop pin</button>`)
    .openOn(map);
}

function renderCheckInMarkers() {
  checkInLayer.clearLayers();
  checkIns.forEach((checkIn) => {
    L.marker([checkIn.lat, checkIn.lon], checkIn.type === "photo" ? { icon: photoIcon(checkIn.previewUrl) } : {})
      .addTo(checkInLayer)
      .bindPopup(`<strong>${checkIn.type === "photo" ? "Photo" : "Check-in"}</strong><br>${escapeHtml(checkIn.label)}<br>${formatTimestamp(checkIn.timestamp)}<br><button type="button" class="map-delete-btn" data-delete-checkin-id="${escapeHtml(checkIn.id)}">Delete pin</button>`);
  });
}

function handleMapPopupAction(event) {
  const dropPinButton = event.target.closest("[data-drop-pin-lat]");
  if (dropPinButton) {
    event.preventDefault();
    event.stopPropagation();
    map.closePopup();
    createMapCheckIn(Number(dropPinButton.dataset.dropPinLat), Number(dropPinButton.dataset.dropPinLng));
    return;
  }

  const deleteButton = event.target.closest("[data-delete-checkin-id]");
  if (!deleteButton) return;
  event.preventDefault();
  event.stopPropagation();
  deleteCheckInById(deleteButton.dataset.deleteCheckinId);
}

function renderPhotoList() {
  if (photoMarkers.length === 0) {
    photoListEl.innerHTML = '<li class="empty-state">No photos mapped yet.</li>';
    return;
  }
  photoListEl.innerHTML = photoMarkers
    .map(
      (photo) => `
        <li>
          <p class="checkin-title">${escapeHtml(photo.name)}</p>
          <p class="checkin-meta">${photo.lat.toFixed(4)}, ${photo.lon.toFixed(4)}</p>
        </li>`
    )
    .join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

async function handleCheckIn(event) {
  event.preventDefault();
  const query = locationInput.value.trim();
  if (!query) return;

  checkInBtn.disabled = true;
  setStatus(checkInStatus, `Looking up "${query}"…`);

  try {
    const { lat, lon, label } = await geocodeLocation(query);

    addCheckIn({ id: createId(), lat, lon, label, timestamp: new Date().toISOString(), type: "location", media: [] });
    map.setView([lat, lon], 12);

    setStatus(checkInStatus, "Checked in!", "success");
    locationInput.value = "";
  } catch (error) {
    setStatus(checkInStatus, error.message, "error");
  } finally {
    checkInBtn.disabled = false;
  }
}

function convertDmsToDecimal(dms, ref) {
  const [degrees, minutes, seconds] = dms;
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (ref === "S" || ref === "W") decimal *= -1;
  return decimal;
}

function createPhotoPreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 96;
        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.onerror = () => resolve("");
      image.src = reader.result;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  setStatus(photoStatus, "Reading photo location data…");

  EXIF.getData(file, async function () {
    const gpsLat = EXIF.getTag(this, "GPSLatitude");
    const gpsLatRef = EXIF.getTag(this, "GPSLatitudeRef");
    const gpsLon = EXIF.getTag(this, "GPSLongitude");
    const gpsLonRef = EXIF.getTag(this, "GPSLongitudeRef");

    if (!gpsLat || !gpsLon) {
      setStatus(photoStatus, "No GPS data found in this photo.", "error");
      return;
    }

    const lat = convertDmsToDecimal(gpsLat, gpsLatRef);
    const lon = convertDmsToDecimal(gpsLon, gpsLonRef);

    const timestamp = new Date().toISOString();
    const previewUrl = await createPhotoPreview(file);
    photoMarkers.push({ name: file.name, lat, lon });
    addCheckIn({ id: createId(), lat, lon, label: file.name, timestamp, type: "photo", previewUrl, media: [] });
    renderPhotoList();

    map.setView([lat, lon], 12);

    setStatus(photoStatus, `Mapped "${file.name}" at ${lat.toFixed(4)}, ${lon.toFixed(4)}.`, "success");
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function handleMediaAttachment(event) {
  const input = event.target;
  const checkIn = checkIns[Number(input.dataset.checkinIndex)];
  if (!checkIn || !input.files.length) return;

  const availableSlots = MAX_MEDIA_FILES - checkIn.media.length;
  const files = Array.from(input.files).slice(0, availableSlots);
  const oversizedFile = files.find((file) => file.size > MAX_MEDIA_SIZE);
  if (oversizedFile) {
    setStatus(checkInStatus, `${oversizedFile.name} is larger than 5 MB.`, "error");
    input.value = "";
    return;
  }

  try {
    const media = await Promise.all(
      files.map(async (file) => ({ name: file.name, type: file.type || "application/octet-stream", dataUrl: await readFileAsDataUrl(file) }))
    );
    checkIn.media.push(...media);
    saveCheckIns();
    renderCheckInList();
    renderCheckInMarkers();
    setStatus(checkInStatus, `${media.length} file${media.length === 1 ? "" : "s"} attached to ${checkIn.label}.`, "success");
  } catch (error) {
    setStatus(checkInStatus, error.message, "error");
  } finally {
    input.value = "";
  }
}

function photoIcon(previewUrl) {
  if (previewUrl) {
    return L.divIcon({
      html: `<img src="${escapeHtml(previewUrl)}" alt="" />`,
      className: "photo-map-icon",
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -21],
    });
  }

  return L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    className: "photo-marker",
  });
}

checkInForm.addEventListener("submit", handleCheckIn);
clearCheckInsBtn.addEventListener("click", clearAllCheckIns);
map.on("contextmenu", handleMapContextMenu);
map.getContainer().addEventListener("click", handleMapPopupAction);
checkInListEl.addEventListener("click", handleCheckInListInteraction);
checkInListEl.addEventListener("click", handleCheckInListAction);
checkInListEl.addEventListener("keydown", handleCheckInListInteraction);
checkInListEl.addEventListener("touchstart", handleCheckInTouchStart, { passive: true });
checkInListEl.addEventListener("touchend", handleCheckInTouchEnd, { passive: true });
checkInListEl.addEventListener("change", (event) => {
  if (event.target.matches(".media-input")) handleMediaAttachment(event);
});
photoInput.addEventListener("change", handlePhotoUpload);

renderCheckInList();
renderCheckInMarkers();
renderPhotoList();
if (checkIns.length > 0) {
  map.setView([checkIns[0].lat, checkIns[0].lon], 10);
}
