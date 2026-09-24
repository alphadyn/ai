const MAX_CHECKINS = 100;
const MAX_MEDIA_FILES = 5;
const MAX_MEDIA_SIZE = 5 * 1024 * 1024;
const SUPABASE_CONFIG = window.CHECKIN_MAP_SUPABASE || {};
const SUPABASE_URL = SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;
const STORAGE_BUCKET = SUPABASE_CONFIG.storageBucket || "checkin-map-media";
const LOCATIONS_TABLE = "checkin_map_locations";
const MEDIA_TABLE = "checkin_map_media";
const TRIPS_TABLE = "checkin_map_trips";
const PROFILES_TABLE = "checkin_map_profiles";
const AUTH_SESSION_KEY = "checkin-map-app:auth-session";

const checkInForm = document.getElementById("checkInForm");
const locationInput = document.getElementById("locationInput");
const checkInBtn = document.getElementById("checkInBtn");
const checkInStatus = document.getElementById("checkInStatus");
const checkInListEl = document.getElementById("checkInList");
const clearCheckInsBtn = document.getElementById("clearCheckInsBtn");
const photoInput = document.getElementById("photoInput");
const photoStatus = document.getElementById("photoStatus");
const photoListEl = document.getElementById("photoList");
const mediaViewer = document.getElementById("mediaViewer");
const mediaViewerClose = document.getElementById("mediaViewerClose");
const mediaViewerPrev = document.getElementById("mediaViewerPrev");
const mediaViewerNext = document.getElementById("mediaViewerNext");
const mediaViewerContent = document.getElementById("mediaViewerContent");
const mediaViewerName = document.getElementById("mediaViewerName");
const mediaViewerDescription = document.getElementById("mediaViewerDescription");
const authPanel = document.getElementById("authPanel");
const appContent = document.getElementById("appContent");
const authForm = document.getElementById("authForm");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const toggleAuthBtn = document.getElementById("toggleAuthBtn");
const authModeLabel = document.getElementById("authModeLabel");
const authStatus = document.getElementById("authStatus");
const userStatus = document.getElementById("userStatus");
const signOutBtn = document.getElementById("signOutBtn");
const loginBtn = document.getElementById("loginBtn");
const profileBtn = document.getElementById("profileBtn");
const profilePanel = document.getElementById("profilePanel");
const closeProfileBtn = document.getElementById("closeProfileBtn");
const profileForm = document.getElementById("profileForm");
const profileUsername = document.getElementById("profileUsername");
const profileDisplayName = document.getElementById("profileDisplayName");
const profileStatus = document.getElementById("profileStatus");
const userAvatar = document.getElementById("userAvatar");
const profileAvatarPreview = document.getElementById("profileAvatarPreview");
const profileAvatarInput = document.getElementById("profileAvatarInput");
const tripsBtn = document.getElementById("tripsBtn");
const tripPanel = document.getElementById("tripPanel");
const closeTripsBtn = document.getElementById("closeTripsBtn");
const tripSelect = document.getElementById("tripSelect");
const tripListEl = document.getElementById("tripList");
const newTripBtn = document.getElementById("newTripBtn");
const tripNameInput = document.getElementById("tripNameInput");
const saveTripBtn = document.getElementById("saveTripBtn");
const tripEditNameInput = document.getElementById("tripEditNameInput");
const saveTripDetailsBtn = document.getElementById("saveTripDetailsBtn");
const tripStatus = document.getElementById("tripStatus");
const adminPanel = document.getElementById("adminPanel");
const adminContent = document.getElementById("adminContent");
const adminStatus = document.getElementById("adminStatus");
const refreshAdminBtn = document.getElementById("refreshAdminBtn");
const shareTripBtn = document.getElementById("shareTripBtn");
const toggleTripPublicBtn = document.getElementById("toggleTripPublicBtn");

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

let checkIns = [];
let photoMarkers = [];
let swipeStartX = null;
let suppressNextListClick = false;
let editingCheckInIndex = null;
let mediaViewerSlides = [];
let mediaViewerIndex = 0;
let mediaViewerTouchStartX = null;
let session = null;
let profile = null;
let trips = [];
let currentTrip = null;
let authMode = "signin";
const publicTripSlug = new URLSearchParams(window.location.search).get("trip");
const isPublicTrip = Boolean(publicTripSlug);

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function authIdentityForUsername(username) {
  return `${normalizeUsername(username)}@users.checkin-map.invalid`;
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

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured. Add credentials to supabase-config.js.");
  }
  try {
    return await fetch(`${SUPABASE_URL.replace(/\/$/, "")}${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error("Could not reach Supabase. Check the project URL and network connection.");
  }
}

async function authRequest(path, body) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await getSupabaseError(response, `Authentication failed (HTTP ${response.status}).`);
    if (/email.*(sign.?ups?|provider).*(disabled|off)|provider.*disabled/i.test(message)) {
      throw new Error("Account creation is disabled in Supabase. Enable Authentication > Providers > Email, then try again.");
    }
    throw new Error(message);
  }
  return response.json();
}

function storeSession(nextSession) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(nextSession));
}

function clearStoredSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

async function restoreSession() {
  const stored = localStorage.getItem(AUTH_SESSION_KEY);
  if (!stored) return null;
  try {
    const previousSession = JSON.parse(stored);
    if (!previousSession.refresh_token) return null;
    const refreshedSession = await authRequest("token?grant_type=refresh_token", { refresh_token: previousSession.refresh_token });
    storeSession(refreshedSession);
    return refreshedSession;
  } catch {
    clearStoredSession();
    return null;
  }
}

async function loadProfile() {
  const response = await supabaseRequest(`/rest/v1/${PROFILES_TABLE}?select=*&id=eq.${encodeURIComponent(session.user.id)}&limit=1`);
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not load your profile."));
  [profile] = await response.json();
  if (!profile) throw new Error("Your account profile is missing.");
}

async function loadTrips() {
  const response = await supabaseRequest(isPublicTrip ? `/rest/v1/${TRIPS_TABLE}?select=*&public_slug=eq.${encodeURIComponent(publicTripSlug)}&is_public=eq.true&limit=1` : `/rest/v1/${TRIPS_TABLE}?select=*&order=created_at.asc`);
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not load trips."));
  trips = await response.json();
  currentTrip = trips[0] || null;
  if (isPublicTrip && !currentTrip) throw new Error("This public trip does not exist or is no longer shared.");
  renderTripSelect();
}

function renderTripSelect() {
  tripListEl.innerHTML = trips.map((trip) => `<article class="trip-card${currentTrip?.id === trip.id ? " active" : ""}" data-trip-id="${escapeHtml(trip.id)}"><div class="trip-card-main"><div><p class="panel-kicker">${trip.is_public ? "Public trip" : "Private trip"}</p><h3>${escapeHtml(trip.name)}</h3><p class="trip-card-meta">Created ${formatTimestamp(trip.created_at)}</p></div><button type="button" class="primary-btn trip-open-btn" data-open-trip="${escapeHtml(trip.id)}">Open</button></div>${canEditTrip() ? `<div class="trip-card-edit"><input type="text" maxlength="100" value="${escapeHtml(trip.name)}" data-trip-name="${escapeHtml(trip.id)}" aria-label="Trip name" /><label class="public-toggle"><input type="checkbox" ${trip.is_public ? "checked" : ""} data-trip-public="${escapeHtml(trip.id)}" /><span>Public</span></label><button type="button" class="secondary-btn" data-save-trip="${escapeHtml(trip.id)}">Save</button>${trip.is_public ? `<button type="button" class="secondary-btn" data-copy-trip="${escapeHtml(trip.id)}">Copy URL <span class="button-icon" aria-hidden="true">⧉</span></button>` : ""}<button type="button" class="delete-checkin-btn" data-delete-trip="${escapeHtml(trip.id)}" aria-label="Delete ${escapeHtml(trip.name)}" title="Delete trip">&times;</button></div>` : ""}</article>`).join("");
  updateTripSharingControls();
}

function updateTripSharingControls() {
  if (tripListEl) return;
  const ownerView = Boolean(canEditTrip() && !isPublicTrip);
  toggleTripPublicBtn.hidden = !ownerView;
  shareTripBtn.hidden = !ownerView || !currentTrip.is_public;
  tripEditNameInput.hidden = !ownerView;
  saveTripDetailsBtn.hidden = !ownerView;
  toggleTripPublicBtn.checked = Boolean(currentTrip?.is_public);
}

async function saveTripCard(tripId) {
  const trip = trips.find((item) => item.id === tripId);
  if (!trip || !canEditTrip()) return;
  const name = tripListEl.querySelector(`[data-trip-name="${CSS.escape(tripId)}"]`).value.trim();
  const isPublic = tripListEl.querySelector(`[data-trip-public="${CSS.escape(tripId)}"]`).checked;
  if (!name) throw new Error("Enter a name for this trip.");
  const response = await supabaseRequest(`/rest/v1/${TRIPS_TABLE}?id=eq.${encodeURIComponent(tripId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ name, is_public: isPublic }) });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not update the trip."));
  trip.name = name;
  trip.is_public = isPublic;
  if (currentTrip?.id === tripId) currentTrip = trip;
  renderTripSelect();
  setStatus(tripStatus, "Trip details saved.", "success");
}

async function copyTripCardUrl(tripId) {
  const trip = trips.find((item) => item.id === tripId);
  if (!trip?.is_public) return;
  await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?trip=${encodeURIComponent(trip.public_slug)}`);
  setStatus(tripStatus, "Public trip URL copied.", "success");
}

async function deleteTripCard(tripId) {
  const trip = trips.find((item) => item.id === tripId);
  if (!trip || !canEditTrip() || !window.confirm(`Delete the trip "${trip.name}" and all its check-ins?`)) return;
  const response = await supabaseRequest(`/rest/v1/${TRIPS_TABLE}?id=eq.${encodeURIComponent(tripId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not delete the trip."));
  trips = trips.filter((item) => item.id !== tripId);
  currentTrip = trips[0] || null;
  renderTripSelect();
  await loadCheckIns();
  renderCheckInList();
  renderCheckInMarkers();
  setStatus(tripStatus, "Trip deleted.", "success");
}

async function handleTripListAction(event) {
  const openButton = event.target.closest("[data-open-trip]");
  if (openButton) {
    currentTrip = trips.find((trip) => trip.id === openButton.dataset.openTrip);
    await loadCheckIns();
    renderCheckInList();
    renderCheckInMarkers();
    renderTripSelect();
    tripPanel.hidden = true;
    tripPanel.classList.remove("trip-panel-open");
    document.body.classList.remove("trips-open");
    if (checkIns.length > 0) map.setView([checkIns[0].lat, checkIns[0].lon], 10);
    setStatus(checkInStatus, `Opened trip "${currentTrip.name}".`, "success");
    return;
  }
  const saveButton = event.target.closest("[data-save-trip]");
  if (saveButton) {
    try { await saveTripCard(saveButton.dataset.saveTrip); } catch (error) { setStatus(tripStatus, error.message, "error"); }
    return;
  }
  const copyButton = event.target.closest("[data-copy-trip]");
  if (copyButton) {
    try { await copyTripCardUrl(copyButton.dataset.copyTrip); } catch (error) { setStatus(tripStatus, error.message, "error"); }
    return;
  }
  const deleteButton = event.target.closest("[data-delete-trip]");
  if (deleteButton) {
    try { await deleteTripCard(deleteButton.dataset.deleteTrip); } catch (error) { setStatus(tripStatus, error.message, "error"); }
  }
}

function createPublicSlug(name) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip"}-${createId().slice(-8)}`;
}

async function copyTripUrl() {
  if (!currentTrip) return;
  if (!currentTrip.is_public) throw new Error("Make this trip public before copying its URL.");
  const slug = currentTrip.public_slug;
  const url = `${window.location.origin}${window.location.pathname}?trip=${encodeURIComponent(slug)}`;
  await navigator.clipboard.writeText(url);
  setStatus(tripStatus, "Public trip URL copied.", "success");
}

async function toggleTripPublic() {
  if (!canEditTrip() || isPublicTrip) return;
  const isPublic = toggleTripPublicBtn.checked;
  const response = await supabaseRequest(`/rest/v1/${TRIPS_TABLE}?id=eq.${encodeURIComponent(currentTrip.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ is_public: isPublic }),
  });
  if (!response.ok) {
    toggleTripPublicBtn.checked = Boolean(currentTrip.is_public);
    throw new Error(await getSupabaseError(response, "Could not update trip visibility."));
  }
  currentTrip.is_public = isPublic;
  updateTripSharingControls();
  setStatus(tripStatus, isPublic ? "Trip is now public." : "Trip is now private.", "success");
}

async function createTrip() {
  const name = tripNameInput.value.trim();
  if (!name) return;
  const response = await supabaseRequest(`/rest/v1/${TRIPS_TABLE}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name, is_public: false, public_slug: createPublicSlug(name) }) });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not create trip."));
  const [trip] = await response.json();
  trips.push(trip);
  currentTrip = trip;
  renderTripSelect();
  await loadCheckIns();
  renderCheckInList();
  renderCheckInMarkers();
  tripNameInput.value = "";
  tripNameInput.hidden = true;
  saveTripBtn.hidden = true;
  setStatus(tripStatus, `Trip "${trip.name}" created.`, "success");
}

async function saveTripDetails() {
  if (!canEditTrip() || isPublicTrip) return;
  const name = tripEditNameInput.value.trim();
  if (!name) throw new Error("Enter a name for this trip.");
  const response = await supabaseRequest(`/rest/v1/${TRIPS_TABLE}?id=eq.${encodeURIComponent(currentTrip.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not update the trip name."));
  currentTrip.name = name;
  const selectedTrip = trips.find((trip) => trip.id === currentTrip.id);
  if (selectedTrip) selectedTrip.name = name;
  renderTripSelect();
  setStatus(tripStatus, "Trip name saved.", "success");
}

async function getSupabaseError(response, fallback) {
  try {
    const body = await response.json();
    return body.message || body.error_description || body.msg || body.error || body.error_code || `${fallback} (HTTP ${response.status}).`;
  } catch {
    return `${fallback} (HTTP ${response.status}).`;
  }
}

function mapLocationRow(row, mediaByCheckIn) {
  return normalizeCheckIn({
    id: row.id,
    lat: row.lat,
    lon: row.lon,
    label: row.label,
    description: row.description || "",
    timestamp: row.timestamp,
    type: row.type,
    previewUrl: row.preview_url || "",
    media: mediaByCheckIn.get(row.id) || [],
    tripId: row.trip_id,
    userId: row.user_id,
  });
}

async function loadCheckIns() {
  if (!currentTrip) { checkIns = []; return; }
  const locationsResponse = await supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}?select=*&trip_id=eq.${encodeURIComponent(currentTrip.id)}&order=timestamp.desc&limit=${MAX_CHECKINS}`);
  if (!locationsResponse.ok) throw new Error(await getSupabaseError(locationsResponse, "Could not load check-ins from Supabase."));
  const mediaResponse = await supabaseRequest(`/rest/v1/${MEDIA_TABLE}?select=*&order=created_at.asc`);
  if (!mediaResponse.ok) throw new Error(await getSupabaseError(mediaResponse, "Could not load check-in media from Supabase."));

  const mediaByCheckIn = new Map();
  (await mediaResponse.json()).forEach((row) => {
    const media = { id: row.id, name: row.name, type: row.mime_type, storagePath: row.storage_path, dataUrl: row.public_url };
    if (!mediaByCheckIn.has(row.checkin_id)) mediaByCheckIn.set(row.checkin_id, []);
    mediaByCheckIn.get(row.checkin_id).push(media);
  });
  checkIns = (await locationsResponse.json()).map((row) => mapLocationRow(row, mediaByCheckIn));
  photoMarkers = checkIns
    .filter((checkIn) => checkIn.type === "photo")
    .map((checkIn) => ({ name: checkIn.label, lat: checkIn.lat, lon: checkIn.lon }));
}

function mapCheckInToRow(checkIn) {
  return {
    id: checkIn.id,
    lat: checkIn.lat,
    lon: checkIn.lon,
    label: checkIn.label,
    description: checkIn.description || "",
    timestamp: checkIn.timestamp,
    type: checkIn.type,
    trip_id: checkIn.tripId || currentTrip.id,
    user_id: session.user.id,
    preview_url: checkIn.previewUrl || null,
    updated_at: new Date().toISOString(),
  };
}

async function saveCheckIn(checkIn) {
  const response = await supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(mapCheckInToRow(checkIn)),
  });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not save the check-in to Supabase."));
}

async function deleteStoredMedia(media) {
  if (!media.storagePath) return;
  const response = await supabaseRequest(`/storage/v1/object/${encodeURIComponent(STORAGE_BUCKET)}/${media.storagePath.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not remove attached media from Supabase."));
}

async function deleteCheckInFromSupabase(checkIn) {
  await Promise.all(checkIn.media.map(deleteStoredMedia));
  const mediaResponse = await supabaseRequest(`/rest/v1/${MEDIA_TABLE}?checkin_id=eq.${encodeURIComponent(checkIn.id)}`, { method: "DELETE" });
  if (!mediaResponse.ok) throw new Error(await getSupabaseError(mediaResponse, "Could not remove check-in media from Supabase."));
  const locationResponse = await supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}?id=eq.${encodeURIComponent(checkIn.id)}`, { method: "DELETE" });
  if (!locationResponse.ok) throw new Error(await getSupabaseError(locationResponse, "Could not remove the check-in from Supabase."));
}

async function deleteAllCheckInsFromSupabase() {
  await Promise.all(checkIns.map((checkIn) => deleteCheckInFromSupabase(checkIn)));
}

function updateClearCheckInsButton() {
  clearCheckInsBtn.disabled = checkIns.length === 0 || !canEditTrip();
}

async function addCheckIn(checkIn) {
  checkIn.tripId = currentTrip.id;
  await saveCheckIn(checkIn);
  checkIns.unshift(checkIn);
  const removedCheckIns = checkIns.splice(MAX_CHECKINS);
  await Promise.all(removedCheckIns.map(deleteCheckInFromSupabase));
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

function isAdmin() {
  return profile?.role === "admin";
}

function canEditTrip() {
  return Boolean(session && currentTrip && (isAdmin() || currentTrip.user_id === session.user.id));
}

function canEditCheckIn(checkIn) {
  return Boolean(session && (isAdmin() || checkIn.userId === session.user.id));
}

function renderCheckInList() {
  if (checkIns.length === 0) {
    checkInListEl.innerHTML = '<li class="empty-state">No check-ins yet.</li>';
    updateClearCheckInsButton();
    return;
  }
  checkInListEl.innerHTML = checkIns
    .map(
      (checkIn, index) => editingCheckInIndex === index ? renderCheckInEditor(checkIn, index) : `
        <li class="checkin-entry" data-checkin-index="${index}" role="button" tabindex="0">
          ${checkIn.previewUrl ? `<img class="checkin-preview" src="${escapeHtml(checkIn.previewUrl)}" alt="${escapeHtml(checkIn.label)}" />` : ""}
          <div>
            <p class="checkin-title">${checkIn.type === "photo" ? "Photo: " : ""}${escapeHtml(checkIn.label)}</p>
            <p class="checkin-meta">${checkIn.lat.toFixed(4)}, ${checkIn.lon.toFixed(4)} &middot; ${formatTimestamp(checkIn.timestamp)}</p>
            ${renderAttachedMedia(checkIn)}
          </div>
          ${canEditCheckIn(checkIn) ? `<button type="button" class="edit-checkin-btn" data-edit-index="${index}" data-stop-map-click="true" aria-label="Edit ${escapeHtml(checkIn.label)}" title="Edit check-in">Edit</button><button type="button" class="delete-checkin-btn" data-delete-index="${index}" data-stop-map-click="true" aria-label="Delete ${escapeHtml(checkIn.label)}" title="Delete check-in">&times;</button>` : ""}
        </li>`
    )
    .join("");
  updateClearCheckInsButton();
}

function renderCheckInEditor(checkIn, index) {
  return `<li class="checkin-entry checkin-editor" data-checkin-index="${index}">
    <form class="edit-checkin-form" data-edit-form-index="${index}" data-stop-map-click="true">
      <label>Location name<input name="label" type="text" value="${escapeHtml(checkIn.label)}" required /></label>
      <label>Date and time<input name="timestamp" type="datetime-local" value="${formatDateTimeInput(checkIn.timestamp)}" required /></label>
      <label>Description<textarea name="description" rows="3" maxlength="500" placeholder="Add a note about this check-in">${escapeHtml(checkIn.description || "")}</textarea></label>
      <label class="attach-media-btn">
        <span>Attach media</span>
        <input class="media-input" type="file" accept="image/*,video/*,audio/*" multiple data-checkin-index="${index}" />
      </label>
      <div class="edit-checkin-actions">
        <button type="submit" class="primary-btn">Save</button>
        <button type="button" class="secondary-btn" data-cancel-edit="true">Cancel</button>
      </div>
    </form>
  </li>`;
}

function formatDateTimeInput(isoString) {
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function clearAllCheckIns() {
  if (!canEditTrip() || !checkIns.length || !window.confirm("Remove all check-ins and their attached media?")) return;
  clearCheckInsBtn.disabled = true;
  setStatus(checkInStatus, "Removing check-ins from Supabase…");
  try {
    await deleteAllCheckInsFromSupabase();
    checkIns = [];
    renderCheckInList();
    renderCheckInMarkers();
    setStatus(checkInStatus, "All check-ins removed.", "success");
  } catch (error) {
    updateClearCheckInsButton();
    setStatus(checkInStatus, error.message, "error");
  }
}

async function deleteCheckIn(index) {
  const checkIn = checkIns[index];
  if (!checkIn || !canEditCheckIn(checkIn) || !window.confirm(`Delete the check-in for ${checkIn.label}?`)) return;
  try {
    await deleteCheckInFromSupabase(checkIn);
    checkIns.splice(index, 1);
    renderCheckInList();
    renderCheckInMarkers();
    setStatus(checkInStatus, "Check-in deleted.", "success");
  } catch (error) {
    setStatus(checkInStatus, error.message, "error");
  }
}

async function deleteCheckInById(id) {
  const index = checkIns.findIndex((checkIn) => checkIn.id === id);
  if (index !== -1) await deleteCheckIn(index);
}

function startEditCheckIn(index) {
  if (!canEditCheckIn(checkIns[index])) return;
  editingCheckInIndex = index;
  renderCheckInList();
  checkInListEl.querySelector("input[name=label]")?.focus();
}

async function saveEditedCheckIn(event) {
  event.preventDefault();
  const form = event.target;
  const index = Number(form.dataset.editFormIndex);
  const checkIn = checkIns[index];
  const label = form.elements.label.value.trim();
  const description = form.elements.description.value.trim();
  const timestamp = new Date(form.elements.timestamp.value);
  if (!checkIn || !canEditCheckIn(checkIn) || !label || Number.isNaN(timestamp.getTime())) return;

  checkIn.label = label;
  checkIn.description = description;
  checkIn.timestamp = timestamp.toISOString();
  try {
    await saveCheckIn(checkIn);
    editingCheckInIndex = null;
    renderCheckInList();
    renderCheckInMarkers();
    setStatus(checkInStatus, "Check-in updated.", "success");
  } catch (error) {
    setStatus(checkInStatus, error.message, "error");
  }
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
  if (!checkIn) return;
  map.flyTo([checkIn.lat, checkIn.lon], 12, { duration: 0.45 });
  checkInListEl.querySelectorAll(".checkin-entry").forEach((entry) => entry.classList.remove("selected"));
  checkInListEl.querySelector(`[data-checkin-index="${index}"]`)?.classList.add("selected");
  let markerIndex = 0;
  checkInLayer.eachLayer((marker) => {
    if (markerIndex === index) marker.openPopup();
    markerIndex += 1;
  });
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
  const editButton = event.target.closest("[data-edit-index]");
  if (editButton) {
    event.preventDefault();
    event.stopPropagation();
    startEditCheckIn(Number(editButton.dataset.editIndex));
    return;
  }

  if (event.target.closest("[data-cancel-edit]")) {
    event.preventDefault();
    event.stopPropagation();
    editingCheckInIndex = null;
    renderCheckInList();
    return;
  }

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
  try {
    await addCheckIn({
      id: createId(),
      lat,
      lon: lng,
      label,
      timestamp: new Date().toISOString(),
      type: "location",
      media: [],
    });
    setStatus(checkInStatus, `Checked in at ${label}.`, "success");
  } catch (error) {
    setStatus(checkInStatus, error.message, "error");
  }
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
      .bindPopup(`<strong>${checkIn.type === "photo" ? "Photo" : "Check-in"}</strong><br>${escapeHtml(checkIn.label)}<br>${formatTimestamp(checkIn.timestamp)}${renderPinMediaCarousel(checkIn)}${canEditCheckIn(checkIn) ? `<br><button type="button" class="map-delete-btn" data-delete-checkin-id="${escapeHtml(checkIn.id)}">Delete pin</button>` : ""}`);
  });
}

function renderPinMediaCarousel(checkIn) {
  if (!checkIn.media.length) return "";
  const slides = checkIn.media
    .map((media, index) => {
      const content = media.type.startsWith("image/")
        ? `<img src="${escapeHtml(media.dataUrl)}" alt="${escapeHtml(media.name)}" />`
        : media.type.startsWith("video/")
          ? `<video src="${escapeHtml(media.dataUrl)}" controls></video>`
          : `<audio src="${escapeHtml(media.dataUrl)}" controls></audio>`;
      return `<div class="pin-media-slide${index === 0 ? " active" : ""}" data-slide-index="${index}" data-media-url="${escapeHtml(media.dataUrl)}" data-media-type="${escapeHtml(media.type)}" data-media-name="${escapeHtml(media.name)}">${content}<span>${escapeHtml(media.name)}</span></div>`;
    })
    .join("");
  return `<div class="pin-media-carousel" data-active-index="0" data-description="${escapeHtml(checkIn.description || "")}"><div class="pin-media-slides">${slides}</div><div class="pin-media-controls"><button type="button" data-carousel-direction="prev" aria-label="Previous media">&#8249;</button><span>${checkIn.media.length} attached</span><button type="button" data-carousel-direction="next" aria-label="Next media">&#8250;</button></div></div>`;
}

function movePinCarousel(carousel, direction) {
  const slides = [...carousel.querySelectorAll(".pin-media-slide")];
  if (slides.length < 2) return;
  const currentIndex = Number(carousel.dataset.activeIndex);
  const nextIndex = (currentIndex + direction + slides.length) % slides.length;
  carousel.dataset.activeIndex = nextIndex;
  slides.forEach((slide, index) => slide.classList.toggle("active", index === nextIndex));
}

function updateMediaViewer() {
  const slide = mediaViewerSlides[mediaViewerIndex];
  if (!slide) return;
  const mediaUrl = slide.dataset.mediaUrl;
  const mediaType = slide.dataset.mediaType;
  const mediaName = slide.dataset.mediaName;
  const mediaElement = mediaType.startsWith("image/")
    ? document.createElement("img")
    : mediaType.startsWith("video/")
      ? document.createElement("video")
      : document.createElement("audio");
  mediaElement.src = mediaUrl;
  mediaElement.controls = true;
  mediaElement.autoplay = mediaType.startsWith("video/") || mediaType.startsWith("audio/");
  mediaElement.alt = mediaName;
  mediaViewerContent.replaceChildren(mediaElement);
  mediaViewerName.textContent = mediaName;
  mediaViewerDescription.textContent = slide.closest(".pin-media-carousel")?.dataset.description || "";
  mediaViewerPrev.disabled = mediaViewerSlides.length < 2;
  mediaViewerNext.disabled = mediaViewerSlides.length < 2;
  mediaViewer.hidden = false;
}

function openMediaViewer(slide) {
  const carousel = slide.closest(".pin-media-carousel");
  mediaViewerSlides = [...carousel.querySelectorAll("[data-media-url]")];
  mediaViewerIndex = mediaViewerSlides.indexOf(slide);
  updateMediaViewer();
}

function moveMediaViewer(direction) {
  if (mediaViewerSlides.length < 2) return;
  mediaViewerIndex = (mediaViewerIndex + direction + mediaViewerSlides.length) % mediaViewerSlides.length;
  updateMediaViewer();
}

function closeMediaViewer() {
  mediaViewer.hidden = true;
  mediaViewerContent.replaceChildren();
  mediaViewerSlides = [];
  mediaViewerIndex = 0;
}

function handleMapPopupAction(event) {
  const carouselButton = event.target.closest("[data-carousel-direction]");
  if (carouselButton) {
    event.preventDefault();
    event.stopPropagation();
    movePinCarousel(carouselButton.closest(".pin-media-carousel"), carouselButton.dataset.carouselDirection === "next" ? 1 : -1);
    return;
  }

  const mediaSlide = event.target.closest("[data-media-url]");
  if (mediaSlide) {
    event.preventDefault();
    event.stopPropagation();
    openMediaViewer(mediaSlide);
    return;
  }

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

    await addCheckIn({ id: createId(), lat, lon, label, timestamp: new Date().toISOString(), type: "location", media: [] });
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
    const checkIn = { id: createId(), lat, lon, label: file.name, timestamp, type: "photo", previewUrl, media: [] };
    await addCheckIn(checkIn);
    await uploadMediaFile(checkIn, file).then((media) => {
      checkIn.media.push(media);
    });
    renderCheckInList();
    renderCheckInMarkers();
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

async function uploadMediaFile(checkIn, file) {
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_");
  const storagePath = `${session.user.id}/${checkIn.id}/${createId()}-${safeName}`;
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await supabaseRequest(`/storage/v1/object/${encodeURIComponent(STORAGE_BUCKET)}/${encodedPath}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
    body: file,
  });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not upload media to Supabase Storage."));

  const publicUrl = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(STORAGE_BUCKET)}/${encodedPath}`;
  const media = { id: createId(), name: file.name, type: file.type || "application/octet-stream", storagePath, dataUrl: publicUrl };
  const metadataResponse = await supabaseRequest(`/rest/v1/${MEDIA_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: media.id,
      checkin_id: checkIn.id,
      user_id: session.user.id,
      name: media.name,
      mime_type: media.type,
      storage_path: media.storagePath,
      public_url: media.dataUrl,
    }),
  });
  if (!metadataResponse.ok) throw new Error(await getSupabaseError(metadataResponse, "Could not save media metadata to Supabase."));
  return media;
}

async function handleMediaAttachment(event) {
  const input = event.target;
  const checkIn = checkIns[Number(input.dataset.checkinIndex)];
  if (!checkIn || !canEditCheckIn(checkIn) || !input.files.length) return;

  const availableSlots = MAX_MEDIA_FILES - checkIn.media.length;
  const files = Array.from(input.files).slice(0, availableSlots);
  const oversizedFile = files.find((file) => file.size > MAX_MEDIA_SIZE);
  if (oversizedFile) {
    setStatus(checkInStatus, `${oversizedFile.name} is larger than 5 MB.`, "error");
    input.value = "";
    return;
  }

  try {
    setStatus(checkInStatus, "Uploading media to Supabase…");
    const media = await Promise.all(files.map((file) => uploadMediaFile(checkIn, file)));
    checkIn.media.push(...media);
    renderCheckInList();
    renderCheckInMarkers();
    setStatus(checkInStatus, `${media.length} file${media.length === 1 ? "" : "s"} attached to ${checkIn.label}.`, "success");
  } catch (error) {
    setStatus(checkInStatus, error.message, "error");
  } finally {
    input.value = "";
  }
}

async function loadAdminData() {
  if (profile?.role !== "admin") return;
  const [usersResponse, tripsResponse, locationsResponse] = await Promise.all([
    supabaseRequest(`/rest/v1/${PROFILES_TABLE}?select=*&order=created_at.asc`),
    supabaseRequest(`/rest/v1/${TRIPS_TABLE}?select=*&order=created_at.desc`),
    supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}?select=id,label,timestamp,trip_id,user_id&order=timestamp.desc&limit=100`),
  ]);
  if (!usersResponse.ok || !tripsResponse.ok || !locationsResponse.ok) throw new Error("Could not load admin data.");
  const users = await usersResponse.json();
  const allTrips = await tripsResponse.json();
  const allLocations = await locationsResponse.json();
  adminContent.innerHTML = `<h3>Users</h3><div class="admin-table">${users.map((user) => `<div class="admin-row"><input data-admin-user-id="${escapeHtml(user.id)}" value="${escapeHtml(user.display_name || "")}" aria-label="Display name" /><select data-admin-role-id="${escapeHtml(user.id)}" aria-label="Role"><option value="user" ${user.role === "user" ? "selected" : ""}>User</option><option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option></select><button type="button" class="secondary-btn" data-save-user="${escapeHtml(user.id)}">Save</button></div>`).join("")}</div><h3>Trips</h3><div class="admin-table">${allTrips.map((trip) => `<div class="admin-row"><input data-admin-trip-name="${escapeHtml(trip.id)}" value="${escapeHtml(trip.name)}" aria-label="Trip name" /><button type="button" class="secondary-btn" data-save-trip="${escapeHtml(trip.id)}">Save</button><button type="button" class="delete-checkin-btn" data-admin-delete-trip="${escapeHtml(trip.id)}">Delete trip</button></div>`).join("")}</div><h3>Check-Ins</h3><div class="admin-table">${allLocations.map((location) => `<div class="admin-row"><input data-admin-label="${escapeHtml(location.id)}" value="${escapeHtml(location.label)}" aria-label="Check-in label" /><input data-admin-time="${escapeHtml(location.id)}" type="datetime-local" value="${formatDateTimeInput(location.timestamp)}" aria-label="Check-in date and time" /><button type="button" class="secondary-btn" data-save-checkin="${escapeHtml(location.id)}">Save</button><button type="button" class="delete-checkin-btn" data-admin-delete-checkin="${escapeHtml(location.id)}">Delete</button></div>`).join("")}</div>`;
}

async function handleAdminAction(event) {
  const saveUser = event.target.closest("[data-save-user]");
  if (saveUser) {
    const id = saveUser.dataset.saveUser;
    const name = adminContent.querySelector(`[data-admin-user-id="${CSS.escape(id)}"]`).value.trim();
    const role = adminContent.querySelector(`[data-admin-role-id="${CSS.escape(id)}"]`).value;
    const response = await supabaseRequest(`/rest/v1/${PROFILES_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ display_name: name, role }) });
    setStatus(adminStatus, response.ok ? "User updated." : await getSupabaseError(response, "Could not update user."), response.ok ? "success" : "error");
    return;
  }
  const deleteTrip = event.target.closest("[data-admin-delete-trip]");
  const saveTrip = event.target.closest("[data-save-trip]");
  if (saveTrip) {
    const id = saveTrip.dataset.saveTrip;
    const name = adminContent.querySelector(`[data-admin-trip-name="${CSS.escape(id)}"]`).value.trim();
    const response = await supabaseRequest(`/rest/v1/${TRIPS_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ name }) });
    setStatus(adminStatus, response.ok ? "Trip updated." : await getSupabaseError(response, "Could not update trip."), response.ok ? "success" : "error");
    return;
  }
  if (deleteTrip && window.confirm("Delete this trip and all its check-ins?")) {
    const response = await supabaseRequest(`/rest/v1/${TRIPS_TABLE}?id=eq.${encodeURIComponent(deleteTrip.dataset.adminDeleteTrip)}`, { method: "DELETE" });
    setStatus(adminStatus, response.ok ? "Trip deleted." : await getSupabaseError(response, "Could not delete trip."), response.ok ? "success" : "error");
    await loadAdminData();
    return;
  }
  const deleteLocation = event.target.closest("[data-admin-delete-checkin]");
  const saveLocation = event.target.closest("[data-save-checkin]");
  if (saveLocation) {
    const id = saveLocation.dataset.saveCheckin;
    const label = adminContent.querySelector(`[data-admin-label="${CSS.escape(id)}"]`).value.trim();
    const timestamp = new Date(adminContent.querySelector(`[data-admin-time="${CSS.escape(id)}"]`).value).toISOString();
    const response = await supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ label, timestamp }) });
    setStatus(adminStatus, response.ok ? "Check-in updated." : await getSupabaseError(response, "Could not update check-in."), response.ok ? "success" : "error");
    return;
  }
  if (deleteLocation && window.confirm("Delete this check-in?")) {
    const response = await supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}?id=eq.${encodeURIComponent(deleteLocation.dataset.adminDeleteCheckin)}`, { method: "DELETE" });
    setStatus(adminStatus, response.ok ? "Check-in deleted." : await getSupabaseError(response, "Could not delete check-in."), response.ok ? "success" : "error");
    await loadAdminData();
  }
}

function openProfile() {
  if (!profile) return;
  profileUsername.value = profile.username || "";
  profileDisplayName.value = profile.display_name || "";
  profileAvatarPreview.src = profile.avatar_url || "";
  profilePanel.hidden = false;
  profilePanel.classList.add("profile-panel-open");
  document.body.classList.add("profile-open");
  profileDisplayName.focus();
}

function closeProfile() {
  profilePanel.hidden = true;
  profilePanel.classList.remove("profile-panel-open");
  document.body.classList.remove("profile-open");
}

function updateAvatar(url) {
  userAvatar.src = url || "";
  userAvatar.hidden = !url;
}

async function uploadAvatar(file) {
  const extension = file.name.split(".").pop().replace(/[^a-z0-9]/gi, "") || "jpg";
  const storagePath = `avatars/${session.user.id}.${extension}`;
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await supabaseRequest(`/storage/v1/object/${encodeURIComponent(STORAGE_BUCKET)}/${encodedPath}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "image/jpeg", "x-upsert": "true" },
    body: file,
  });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not upload your avatar."));
  return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(STORAGE_BUCKET)}/${encodedPath}?v=${Date.now()}`;
}

async function saveProfile(event) {
  event.preventDefault();
  const displayName = profileDisplayName.value.trim();
  const avatarFile = profileAvatarInput.files[0];
  let avatarUrl = profile.avatar_url || null;
  if (avatarFile) avatarUrl = await uploadAvatar(avatarFile);
  const response = await supabaseRequest(`/rest/v1/${PROFILES_TABLE}?id=eq.${encodeURIComponent(session.user.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ display_name: displayName, avatar_url: avatarUrl }),
  });
  if (!response.ok) {
    const error = await getSupabaseError(response, "Could not save your profile.");
    if (/avatar_url.*schema cache|column.*avatar_url/i.test(error)) {
      throw new Error("Your Supabase schema needs the avatar update. Run checkin_map_app/supabase-schema.sql, then refresh the app.");
    }
    throw new Error(error);
  }
  profile.display_name = displayName;
  profile.avatar_url = avatarUrl;
  userStatus.textContent = profile.username || profile.display_name;
  updateAvatar(avatarUrl);
  profileAvatarPreview.src = avatarUrl || "";
  profileAvatarInput.value = "";
  setStatus(profileStatus, "Profile saved.", "success");
}

async function enterApp(nextSession) {
  session = nextSession;
  await loadProfile();
  authPanel.hidden = true;
  appContent.hidden = false;
  signOutBtn.hidden = false;
  loginBtn.hidden = true;
  profileBtn.hidden = false;
  tripsBtn.hidden = false;
  userStatus.textContent = profile.username || profile.display_name;
  updateAvatar(profile.avatar_url);
  adminPanel.hidden = profile.role !== "admin";
  await loadTrips();
  if (!currentTrip) {
    await createTripRecord("My first trip");
    await loadTrips();
  }
  await loadCheckIns();
  renderCheckInList();
  renderCheckInMarkers();
  renderPhotoList();
  updateClearCheckInsButton();
  if (profile.role === "admin") await loadAdminData();
  window.setTimeout(() => map.invalidateSize(), 0);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  authSubmitBtn.disabled = true;
  try {
    const username = normalizeUsername(authUsername.value);
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) throw new Error("Use 3–32 letters, numbers, dots, dashes, or underscores.");
    const data = authMode === "signin"
      ? await authRequest("token?grant_type=password", { email: authIdentityForUsername(username), password: authPassword.value })
      : await authRequest("signup", { email: authIdentityForUsername(username), password: authPassword.value, data: { username } });
    if (!data.access_token) throw new Error("Account created. Confirm your email, then sign in.");
    storeSession(data);
    await enterApp(data);
    setStatus(authStatus, "Signed in.", "success");
  } catch (error) {
    setStatus(authStatus, error.message, "error");
  } finally {
    authSubmitBtn.disabled = false;
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
loginBtn.addEventListener("click", () => {
  authPanel.hidden = false;
  authUsername.focus();
});
profileBtn.addEventListener("click", openProfile);
closeProfileBtn.addEventListener("click", closeProfile);
profileForm.addEventListener("submit", async (event) => {
  try { await saveProfile(event); } catch (error) { setStatus(profileStatus, error.message, "error"); }
});
profileAvatarInput.addEventListener("change", () => {
  const [file] = profileAvatarInput.files;
  if (file) profileAvatarPreview.src = URL.createObjectURL(file);
});
tripsBtn.addEventListener("click", () => {
  tripPanel.hidden = false;
  tripPanel.classList.add("trip-panel-open");
  document.body.classList.add("trips-open");
  tripListEl.querySelector(".trip-card.active")?.focus();
});
closeTripsBtn.addEventListener("click", () => {
  tripPanel.hidden = true;
  tripPanel.classList.remove("trip-panel-open");
  document.body.classList.remove("trips-open");
});
authForm.addEventListener("submit", handleAuthSubmit);
toggleAuthBtn.addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  authSubmitBtn.textContent = authMode === "signin" ? "Sign in" : "Create account";
  toggleAuthBtn.textContent = authMode === "signin" ? "Create account" : "Back to sign in";
  authModeLabel.textContent = authMode === "signin" ? "Sign in" : "Create account";
});
signOutBtn.addEventListener("click", () => {
  clearStoredSession();
  window.location.reload();
});
tripListEl.addEventListener("click", handleTripListAction);
newTripBtn.addEventListener("click", () => {
  tripNameInput.hidden = false;
  saveTripBtn.hidden = false;
  tripNameInput.focus();
});
saveTripBtn.addEventListener("click", async () => {
  try { await createTrip(); } catch (error) { setStatus(tripStatus, error.message, "error"); }
});
refreshAdminBtn.addEventListener("click", async () => {
  try { await loadAdminData(); setStatus(adminStatus, "Admin data refreshed.", "success"); } catch (error) { setStatus(adminStatus, error.message, "error"); }
});
adminContent.addEventListener("click", handleAdminAction);
clearCheckInsBtn.addEventListener("click", clearAllCheckIns);
map.on("contextmenu", handleMapContextMenu);
map.getContainer().addEventListener("click", handleMapPopupAction);
checkInListEl.addEventListener("click", handleCheckInListInteraction);
checkInListEl.addEventListener("click", handleCheckInListAction);
checkInListEl.addEventListener("keydown", handleCheckInListInteraction);
checkInListEl.addEventListener("submit", saveEditedCheckIn);
checkInListEl.addEventListener("touchstart", handleCheckInTouchStart, { passive: true });
checkInListEl.addEventListener("touchend", handleCheckInTouchEnd, { passive: true });
checkInListEl.addEventListener("change", (event) => {
  if (event.target.matches(".media-input")) handleMediaAttachment(event);
});
photoInput.addEventListener("change", handlePhotoUpload);
mediaViewerClose.addEventListener("click", closeMediaViewer);
mediaViewerPrev.addEventListener("click", () => moveMediaViewer(-1));
mediaViewerNext.addEventListener("click", () => moveMediaViewer(1));
mediaViewer.addEventListener("click", (event) => {
  if (event.target === mediaViewer) closeMediaViewer();
});
mediaViewer.addEventListener("touchstart", (event) => {
  if (event.touches.length === 1) mediaViewerTouchStartX = event.touches[0].clientX;
}, { passive: true });
mediaViewer.addEventListener("touchend", (event) => {
  if (mediaViewerTouchStartX === null) return;
  const distance = event.changedTouches[0].clientX - mediaViewerTouchStartX;
  mediaViewerTouchStartX = null;
  if (Math.abs(distance) > 55) moveMediaViewer(distance < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener("keydown", (event) => {
  if (mediaViewer.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeMediaViewer();
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    event.stopImmediatePropagation();
    moveMediaViewer(event.key === "ArrowLeft" ? -1 : 1);
  }
}, true);

async function initializeApp() {
  renderCheckInList();
  renderCheckInMarkers();
  renderPhotoList();
  if (isPublicTrip) {
    authPanel.hidden = true;
    appContent.hidden = false;
    document.body.classList.add("public-trip-view");
    try {
      await loadTrips();
      await loadCheckIns();
      renderTripSelect();
      renderCheckInList();
      renderCheckInMarkers();
      renderPhotoList();
      userStatus.textContent = `Trip: ${currentTrip.name}`;
      tripsBtn.hidden = false;
      setStatus(checkInStatus, "Viewing a public trip.", "success");
      window.setTimeout(() => map.invalidateSize(), 0);
    } catch (error) {
      setStatus(checkInStatus, error.message, "error");
    }
    return;
  }
  const restoredSession = await restoreSession();
  if (restoredSession) {
    try {
      await enterApp(restoredSession);
      setStatus(checkInStatus, "Session restored.", "success");
      return;
    } catch (error) {
      clearStoredSession();
      setStatus(authStatus, error.message, "error");
    }
  }
  setStatus(checkInStatus, "Sign in to load your trips.");
}

initializeApp();
