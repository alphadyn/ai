const STORAGE_KEY = "checkin-map-app:checkins";
const MAX_CHECKINS = 10;

const checkInForm = document.getElementById("checkInForm");
const locationInput = document.getElementById("locationInput");
const checkInBtn = document.getElementById("checkInBtn");
const checkInStatus = document.getElementById("checkInStatus");
const checkInListEl = document.getElementById("checkInList");
const photoInput = document.getElementById("photoInput");
const photoStatus = document.getElementById("photoStatus");
const photoListEl = document.getElementById("photoList");

const map = L.map("map").setView([20, 0], 2);
// OpenStreetMap's own tile servers block requests from most referers/origins that
// aren't a registered production site (see https://wiki.openstreetmap.org/wiki/Blocked_tiles).
// CARTO's free basemap tiles are built from OSM data and don't apply that restriction.
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19,
}).addTo(map);

const checkInLayer = L.layerGroup().addTo(map);
const photoLayer = L.layerGroup().addTo(map);

let checkIns = loadCheckIns();
let photoMarkers = [];

function loadCheckIns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCheckIns() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checkIns));
}

function addCheckIn(checkIn) {
  checkIns.unshift(checkIn);
  checkIns = checkIns.slice(0, MAX_CHECKINS);
  saveCheckIns();
  renderCheckInList();
  renderCheckInMarkers();
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
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
    { headers: { Accept: "application/json" } }
  );
  if (!response.ok) throw new Error("location lookup failed");
  const results = await response.json();
  if (results.length === 0) throw new Error(`No known location found for "${query}".`);
  const [result] = results;
  return { lat: parseFloat(result.lat), lon: parseFloat(result.lon), label: result.display_name };
}

function renderCheckInList() {
  if (checkIns.length === 0) {
    checkInListEl.innerHTML = '<li class="empty-state">No check-ins yet.</li>';
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
          </div>
        </li>`
    )
    .join("");
}

function centerMapOnCheckIn(index) {
  const checkIn = checkIns[index];
  if (checkIn) map.setView([checkIn.lat, checkIn.lon], 12);
}

function handleCheckInListInteraction(event) {
  const entry = event.target.closest("[data-checkin-index]");
  if (!entry) return;

  if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
  if (event.type === "keydown") event.preventDefault();
  centerMapOnCheckIn(Number(entry.dataset.checkinIndex));
}

function renderCheckInMarkers() {
  checkInLayer.clearLayers();
  checkIns.forEach((checkIn) => {
    L.marker([checkIn.lat, checkIn.lon])
      .addTo(checkInLayer)
      .bindPopup(`<strong>Check-in</strong><br>${escapeHtml(checkIn.label)}<br>${formatTimestamp(checkIn.timestamp)}`);
  });
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

    addCheckIn({ lat, lon, label, timestamp: new Date().toISOString(), type: "location" });
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
    addCheckIn({ lat, lon, label: file.name, timestamp, type: "photo", previewUrl });
    renderPhotoList();

    L.marker([lat, lon], { icon: photoIcon() })
      .addTo(photoLayer)
      .bindPopup(`<strong>Photo</strong><br>${escapeHtml(file.name)}`)
      .openPopup();
    map.setView([lat, lon], 12);

    setStatus(photoStatus, `Mapped "${file.name}" at ${lat.toFixed(4)}, ${lon.toFixed(4)}.`, "success");
  });
}

function photoIcon() {
  return L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    className: "photo-marker",
  });
}

checkInForm.addEventListener("submit", handleCheckIn);
checkInListEl.addEventListener("click", handleCheckInListInteraction);
checkInListEl.addEventListener("keydown", handleCheckInListInteraction);
photoInput.addEventListener("change", handlePhotoUpload);

renderCheckInList();
renderCheckInMarkers();
renderPhotoList();
if (checkIns.length > 0) {
  map.setView([checkIns[0].lat, checkIns[0].lon], 10);
}
