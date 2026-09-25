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
const EXPERIENCES_TABLE = "checkin_map_experiences";
const AUTH_SESSION_KEY = "checkin-map-app:auth-session";

const checkInForm = document.getElementById("checkInForm");
const locationInput = document.getElementById("locationInput");
const checkInBtn = document.getElementById("checkInBtn");
const checkInStatus = document.getElementById("checkInStatus");
const checkInListEl = document.getElementById("checkInList");
const checkInTripName = document.getElementById("checkInTripName");
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
const welcomePanel = document.getElementById("welcomePanel");
const welcomeNewTripBtn = document.getElementById("welcomeNewTripBtn");
const welcomeExploreBtn = document.getElementById("welcomeExploreBtn");
const authForm = document.getElementById("authForm");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authModeLabel = document.getElementById("authModeLabel");
const authStatus = document.getElementById("authStatus");
const userStatus = document.getElementById("userStatus");
const signOutBtn = document.getElementById("signOutBtn");
const loginBtn = document.getElementById("loginBtn");
const createProfileBtn = document.getElementById("createProfileBtn");
const profileBtn = document.getElementById("profileBtn");
const profilePanel = document.getElementById("profilePanel");
const closeProfileBtn = document.getElementById("closeProfileBtn");
const profileForm = document.getElementById("profileForm");
const profileUsername = document.getElementById("profileUsername");
const profileDisplayName = document.getElementById("profileDisplayName");
const profileStatusInput = document.getElementById("profileStatusInput");
const profileUrlInput = document.getElementById("profileUrlInput");
const profileStatus = document.getElementById("profileStatus");
const userAvatar = document.getElementById("userAvatar");
const profileAvatarPreview = document.getElementById("profileAvatarPreview");
const profileAvatarInput = document.getElementById("profileAvatarInput");
const tripsBtn = document.getElementById("tripsBtn");
const experiencesBtn = document.getElementById("experiencesBtn");
const tripPanel = document.getElementById("tripPanel");
const experiencePanel = document.getElementById("experiencePanel");
const closeTripsBtn = document.getElementById("closeTripsBtn");
const closeExperiencesBtn = document.getElementById("closeExperiencesBtn");
const newTripPanel = document.getElementById("newTripPanel");
const newTripForm = document.getElementById("newTripForm");
const newTripNameInput = document.getElementById("newTripNameInput");
const backFromNewTripBtn = document.getElementById("backFromNewTripBtn");
const cancelNewTripBtn = document.getElementById("cancelNewTripBtn");
const newTripStatus = document.getElementById("newTripStatus");
const renameTripPanel = document.getElementById("renameTripPanel");
const renameTripForm = document.getElementById("renameTripForm");
const renameTripNameInput = document.getElementById("renameTripNameInput");
const backFromRenameBtn = document.getElementById("backFromRenameBtn");
const cancelRenameBtn = document.getElementById("cancelRenameBtn");
const renameTripStatus = document.getElementById("renameTripStatus");
const tripListEl = document.getElementById("tripList");
const newTripBtn = document.getElementById("newTripBtn");
const tripStatus = document.getElementById("tripStatus");
const adminPanel = document.getElementById("adminPanel");
const adminContent = document.getElementById("adminContent");
const adminStatus = document.getElementById("adminStatus");
const refreshAdminBtn = document.getElementById("refreshAdminBtn");
const experienceForm = document.getElementById("experienceForm");
const experienceIndexScreen = document.getElementById("experienceIndexScreen");
const experienceCreateScreen = document.getElementById("experienceCreateScreen");
const newExperienceBtn = document.getElementById("newExperienceBtn");
const backFromExperienceCreateBtn = document.getElementById("backFromExperienceCreateBtn");
const experienceIdInput = document.getElementById("experienceIdInput");
const experienceNameInput = document.getElementById("experienceNameInput");
const experienceDescriptionInput = document.getElementById("experienceDescriptionInput");
const experienceSaveBtn = document.getElementById("experienceSaveBtn");
const experienceStatus = document.getElementById("experienceStatus");
const experienceList = document.getElementById("experienceList");
const experienceDetail = document.getElementById("experienceDetail");
const experienceDetailKicker = document.getElementById("experienceDetailKicker");
const activeExperienceName = document.getElementById("activeExperienceName");
const activeExperienceDescription = document.getElementById("activeExperienceDescription");
const experienceDoneBtn = document.getElementById("experienceDoneBtn");
const experienceEditDetailsBtn = document.getElementById("experienceEditDetailsBtn");
const newExperienceEventBtn = document.getElementById("newExperienceEventBtn");
const experienceEventCreateScreen = document.getElementById("experienceEventCreateScreen");
const backFromExperienceEventCreateBtn = document.getElementById("backFromExperienceEventCreateBtn");
const experienceLocationForm = document.getElementById("experienceLocationForm");
const experienceEventNameInput = document.getElementById("experienceEventNameInput");
const experienceLocationInput = document.getElementById("experienceLocationInput");
const experienceTimeInput = document.getElementById("experienceTimeInput");
const experienceEventDescriptionInput = document.getElementById("experienceEventDescriptionInput");
const experienceEventMediaInput = document.getElementById("experienceEventMediaInput");
const experienceEventMediaPreview = document.getElementById("experienceEventMediaPreview");
const findExperienceEventLocationBtn = document.getElementById("findExperienceEventLocationBtn");
const experienceEventCreateMapElement = document.getElementById("experienceEventCreateMap");
const experienceLocationList = document.getElementById("experienceLocationList");
const experienceEventEditScreen = document.getElementById("experienceEventEditScreen");
const experienceEventEditName = document.getElementById("experienceEventEditName");
const experienceEventEditContent = document.getElementById("experienceEventEditContent");
const backFromExperienceEventEditBtn = document.getElementById("backFromExperienceEventEditBtn");
const experienceEventEditMapElement = document.getElementById("experienceEventEditMap");
const experienceMapElement = document.getElementById("experienceMap");

const mapElement = document.getElementById("map");
const loggedOutPreviewImage = document.getElementById("loggedOutPreviewImage");
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
const experienceLayer = L.layerGroup().addTo(map);
const experienceMap = L.map(experienceMapElement, { zoomControl: true, attributionControl: false }).setView([0, 0], 1);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2w0f_1_82cba88eb21776b6335fa821", {
  subdomains: "abcd",
  maxZoom: 19,
  noWrap: true,
}).addTo(experienceMap);
const experienceMapLayer = L.layerGroup().addTo(experienceMap);
const experienceEventEditMap = L.map(experienceEventEditMapElement, { zoomControl: true, attributionControl: false }).setView([0, 0], 1);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2w0f_1_82cba88eb21776b6335fa821", {
  subdomains: "abcd",
  maxZoom: 19,
  noWrap: true,
}).addTo(experienceEventEditMap);
let experienceEventEditMarker = null;
let experienceEventEditCoordinates = null;
const experienceEventCreateMap = L.map(experienceEventCreateMapElement, { zoomControl: true, attributionControl: false }).setView([0, 0], 1);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2w0f_1_82cba88eb21776b6335fa821", {
  subdomains: "abcd",
  maxZoom: 19,
  noWrap: true,
}).addTo(experienceEventCreateMap);
let experienceEventCreateMarker = null;
let experienceEventCreateCoordinates = null;
const experienceMapResetControl = L.control({ position: "topleft" });
experienceMapResetControl.onAdd = () => {
  const button = L.DomUtil.create("button", "experience-map-reset");
  button.type = "button";
  button.textContent = "↺";
  button.title = "Reset event map view";
  button.setAttribute("aria-label", "Reset event map view");
  L.DomEvent.disableClickPropagation(button);
  L.DomEvent.on(button, "click", fitExperienceMap);
  return button;
};
experienceMapResetControl.addTo(experienceMap);

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
let experiences = [];
let activeExperience = null;
let experienceLocations = [];
let editingExperienceLocationId = null;
let experienceViewMode = "view";
let experienceMarkersByLocationId = new Map();
let pendingExperienceEventFiles = [];
let draggedExperienceId = null;
let tripPageScrollY = null;
let draggedTripId = null;
let authMode = "signin";
const pageParams = new URLSearchParams(window.location.search);
const publicExperienceSlug = pageParams.get("experience");
const isExperienceUrl = Boolean(publicExperienceSlug);
const publicTripSlug = pageParams.get("trip");
const isPublicTrip = Boolean(publicTripSlug);
let isPublicExperience = false;

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function lockTripPageScroll() {
  if (tripPageScrollY !== null) return;
  tripPageScrollY = window.scrollY;
  document.body.style.setProperty("--trip-page-scroll-y", `-${tripPageScrollY}px`);
  document.body.classList.add("trips-open");
}

function unlockTripPageScroll() {
  if (tripPageScrollY === null) return;
  const scrollY = tripPageScrollY;
  tripPageScrollY = null;
  document.body.classList.remove("trips-open");
  document.body.style.removeProperty("--trip-page-scroll-y");
  window.scrollTo(0, scrollY);
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
      credentials: "omit",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
        ...(options.body !== undefined && !options.headers?.["Content-Type"] ? { "Content-Type": "application/json" } : {}),
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
    credentials: "omit",
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
  const response = await supabaseRequest(isPublicTrip && !session ? `/rest/v1/${TRIPS_TABLE}?select=*&public_slug=eq.${encodeURIComponent(publicTripSlug)}&is_public=eq.true&limit=1` : `/rest/v1/${TRIPS_TABLE}?select=*&order=sort_order.asc,created_at.asc`);
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not load trips."));
  trips = await response.json();
  currentTrip = trips[0] || null;
  if (isPublicTrip && !session && !currentTrip) throw new Error("This public trip does not exist or is no longer shared.");
  updateCheckInTripName();
  renderTripSelect();
}

async function loadExperiences(options = {}) {
  const { scopeToUrl = false } = options;
  const publicRequest = { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } };
  const useAnonymousExperienceRequest = scopeToUrl && isExperienceUrl && !session;
  const experiencePath = scopeToUrl && isExperienceUrl
    ? `/rest/v1/${EXPERIENCES_TABLE}?select=*&public_slug=eq.${encodeURIComponent(publicExperienceSlug)}${useAnonymousExperienceRequest ? "&is_public=eq.true" : ""}&limit=1`
    : `/rest/v1/${EXPERIENCES_TABLE}?select=*&order=sort_order.asc,created_at.asc`;
  const response = await supabaseRequest(experiencePath, useAnonymousExperienceRequest ? publicRequest : undefined);
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not load experiences."));
  experiences = await response.json();
  if (scopeToUrl) {
    isPublicExperience = Boolean(experiences[0]?.is_public);
    if (!experiences.length) throw new Error("This experience is private or no longer exists.");
  }
  if (activeExperience) activeExperience = experiences.find((experience) => experience.id === activeExperience.id) || null;
  renderExperiences();
}

async function loadExperienceLocations() {
  if (!activeExperience) {
    experienceLocations = [];
    return;
  }
  const [locationsResponse, mediaResponse] = await Promise.all([
    supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}?select=*&experience_id=eq.${encodeURIComponent(activeExperience.id)}&order=timestamp.asc`, isPublicExperience ? { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } } : undefined),
    supabaseRequest(`/rest/v1/${MEDIA_TABLE}?select=*&order=created_at.asc`, isPublicExperience ? { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } } : undefined),
  ]);
  if (!locationsResponse.ok) throw new Error(await getSupabaseError(locationsResponse, "Could not load experience locations."));
  if (!mediaResponse.ok) throw new Error(await getSupabaseError(mediaResponse, "Could not load experience media."));
  const mediaByLocation = new Map();
  (await mediaResponse.json()).forEach((row) => {
    const media = { id: row.id, name: row.name, type: row.mime_type, storagePath: row.storage_path, dataUrl: row.public_url };
    if (!mediaByLocation.has(row.checkin_id)) mediaByLocation.set(row.checkin_id, []);
    mediaByLocation.get(row.checkin_id).push(media);
  });
  experienceLocations = (await locationsResponse.json()).map((row) => mapLocationRow(row, mediaByLocation));
  renderExperienceLocations();
  renderExperienceMarkers();
}

function resetExperienceForm() {
  experienceForm.reset();
  experienceIdInput.value = "";
  experienceSaveBtn.textContent = "Save";
}

function showExperienceScreen(screen) {
  const screens = {
    index: experienceIndexScreen,
    create: experienceCreateScreen,
    detail: experienceDetail,
    eventCreate: experienceEventCreateScreen,
    eventEdit: experienceEventEditScreen,
  };
  Object.entries(screens).forEach(([name, element]) => { element.hidden = name !== screen; });
}

async function showExperienceIndex() {
  activeExperience = null;
  experienceLocations = [];
  experienceViewMode = "view";
  experienceLayer.clearLayers();
  experiencePanel.classList.remove("experience-detail-open");
  showExperienceScreen("index");
  resetExperienceForm();
  if (session && isExperienceUrl) {
    history.replaceState(null, "", window.location.pathname);
    document.body.classList.remove("public-experience-view");
    await loadExperiences();
    return;
  }
  renderExperiences();
}

function showExperienceCreate() {
  activeExperience = null;
  experienceLocations = [];
  experienceLayer.clearLayers();
  experiencePanel.classList.remove("experience-detail-open");
  showExperienceScreen("create");
  resetExperienceForm();
  experienceNameInput.focus();
}

function renderExperiences() {
  experienceList.innerHTML = experiences.length ? experiences.map((experience, index) => `
    <article class="experience-card${activeExperience?.id === experience.id ? " active" : ""}" data-experience-id="${escapeHtml(experience.id)}" draggable="${canEditExperience(experience)}">
      <div class="experience-card-open">
        <span class="experience-card-kicker">${experience.is_public ? "Public experience" : "Private experience"}</span><strong>${escapeHtml(experience.name)}</strong>
        ${experience.description ? `<span>${escapeHtml(experience.description)}</span>` : ""}
      </div>
      <div class="experience-card-actions">
        ${canEditExperience(experience) ? `<div class="experience-order-controls" aria-label="Reorder ${escapeHtml(experience.name)}"><button type="button" class="secondary-btn icon-btn" data-move-experience="up" data-experience-id="${escapeHtml(experience.id)}" aria-label="Move ${escapeHtml(experience.name)} up" title="Move up" ${index === 0 ? "disabled" : ""}>&uarr;</button><button type="button" class="secondary-btn icon-btn" data-move-experience="down" data-experience-id="${escapeHtml(experience.id)}" aria-label="Move ${escapeHtml(experience.name)} down" title="Move down" ${index === experiences.length - 1 ? "disabled" : ""}>&darr;</button></div><label class="public-toggle compact-toggle"><input type="checkbox" data-experience-public="${escapeHtml(experience.id)}" ${experience.is_public ? "checked" : ""} /><span>Public</span></label><button type="button" class="secondary-btn" data-edit-experience="${escapeHtml(experience.id)}">Edit</button><button type="button" class="secondary-btn" data-duplicate-experience="${escapeHtml(experience.id)}">Duplicate</button><button type="button" class="secondary-btn" data-copy-experience="${escapeHtml(experience.id)}">Copy URL <span class="button-icon" aria-hidden="true">⧉</span></button><button type="button" class="delete-checkin-btn" data-delete-experience="${escapeHtml(experience.id)}" aria-label="Delete ${escapeHtml(experience.name)}" title="Delete experience">&times;</button>` : ""}
      </div>
    </article>`).join("") : '<p class="empty-experience-state">Create an experience, then collect its events, places, and media.</p>';
  experienceDetail.hidden = !activeExperience;
  if (activeExperience) {
    activeExperienceName.textContent = activeExperience.name;
    activeExperienceName.disabled = !canEditExperience(activeExperience);
    activeExperienceDescription.textContent = activeExperience.description || "Add events, places, and media to this experience.";
    experienceLocationForm.hidden = true;
    experienceDetailKicker.textContent = "Experience";
    experienceEditDetailsBtn.hidden = !canEditExperience(activeExperience) || experienceViewMode === "edit";
    const canAddEvent = canEditExperience(activeExperience) || (isPublicExperience && activeExperience.is_public);
    newExperienceEventBtn.hidden = !canAddEvent || (experienceViewMode !== "edit" && !isPublicExperience);
  }
}

async function moveExperience(id, direction) {
  const currentIndex = experiences.findIndex((experience) => experience.id === id);
  const targetIndex = currentIndex + (direction === "up" ? -1 : 1);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= experiences.length) return;
  const reorderedExperiences = [...experiences];
  [reorderedExperiences[currentIndex], reorderedExperiences[targetIndex]] = [reorderedExperiences[targetIndex], reorderedExperiences[currentIndex]];
  await saveExperienceOrder(reorderedExperiences);
}

async function saveExperienceOrder(reorderedExperiences) {
  const responses = await Promise.all(reorderedExperiences.map((experience, index) => supabaseRequest(
    `/rest/v1/${EXPERIENCES_TABLE}?id=eq.${encodeURIComponent(experience.id)}`,
    { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sort_order: index + 1 }) }
  )));
  const failedResponse = responses.find((response) => !response.ok);
  if (failedResponse) throw new Error(await getSupabaseError(failedResponse, "Could not reorder experiences."));
  experiences = reorderedExperiences.map((experience, index) => ({ ...experience, sort_order: index + 1 }));
  renderExperiences();
  setStatus(experienceStatus, "Experience order saved.", "success");
}

function clearExperienceDragState() {
  draggedExperienceId = null;
  experienceList.querySelectorAll(".is-dragging, .drag-over-before, .drag-over-after").forEach((card) => card.classList.remove("is-dragging", "drag-over-before", "drag-over-after"));
}

function handleExperienceDragStart(event) {
  const card = event.target.closest('.experience-card[draggable="true"]');
  if (!card || event.target.closest("button, input, label")) {
    event.preventDefault();
    return;
  }
  draggedExperienceId = card.dataset.experienceId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedExperienceId);
  card.classList.add("is-dragging");
}

function handleExperienceDragOver(event) {
  if (!draggedExperienceId) return;
  const card = event.target.closest(".experience-card");
  if (!card || card.dataset.experienceId === draggedExperienceId) return;
  event.preventDefault();
  experienceList.querySelectorAll(".drag-over-before, .drag-over-after").forEach((item) => item.classList.remove("drag-over-before", "drag-over-after"));
  card.classList.add(event.clientY < card.getBoundingClientRect().top + card.offsetHeight / 2 ? "drag-over-before" : "drag-over-after");
  event.dataTransfer.dropEffect = "move";
}

async function handleExperienceDrop(event) {
  const targetCard = event.target.closest(".experience-card");
  if (!draggedExperienceId || !targetCard || targetCard.dataset.experienceId === draggedExperienceId) return;
  event.preventDefault();
  const sourceIndex = experiences.findIndex((experience) => experience.id === draggedExperienceId);
  let targetIndex = experiences.findIndex((experience) => experience.id === targetCard.dataset.experienceId);
  if (event.clientY >= targetCard.getBoundingClientRect().top + targetCard.offsetHeight / 2) targetIndex += 1;
  const reorderedExperiences = [...experiences];
  const [draggedExperience] = reorderedExperiences.splice(sourceIndex, 1);
  if (sourceIndex < targetIndex) targetIndex -= 1;
  reorderedExperiences.splice(targetIndex, 0, draggedExperience);
  try { await saveExperienceOrder(reorderedExperiences); }
  catch (error) { setStatus(experienceStatus, error.message, "error"); }
  finally { clearExperienceDragState(); }
}

function renderExperienceLocations() {
  if (!activeExperience) return;
  experienceLocationList.innerHTML = experienceLocations.length ? experienceLocations.map((location) => `
    <li class="experience-location-card" data-experience-location-id="${escapeHtml(location.id)}">
      <div class="experience-location-summary">
        <button type="button" class="experience-location-open" data-show-experience-location="${escapeHtml(location.id)}"><strong>${escapeHtml(location.eventName || location.label)}</strong><span>${escapeHtml(location.label)} &middot; ${formatTimestamp(location.timestamp)}</span></button>
        ${canEditExperience(activeExperience) || (isPublicExperience && activeExperience.is_public) ? `<div class="experience-location-actions"><button type="button" class="secondary-btn" data-edit-experience-location="${escapeHtml(location.id)}">Edit</button>${canEditExperience(activeExperience) && experienceViewMode === "edit" ? `<button type="button" class="secondary-btn icon-btn event-remove-btn" data-delete-experience-location="${escapeHtml(location.id)}" aria-label="Delete ${escapeHtml(location.label)}" title="Delete event">&minus;</button>` : ""}</div>` : ""}
      </div>
      ${location.description ? `<p>${escapeHtml(location.description)}</p>` : ""}
      ${renderPinMediaCarousel(location)}
    </li>`).join("") : '<li class="empty-state">No locations yet. Add the first moment above.</li>';
}

function renderExperienceMediaAvatars(location) {
  if (!location.media.length) return "";
  return `<div class="event-media-avatars" aria-label="Attached files">${location.media.map((media) => {
    const avatar = media.type.startsWith("image/")
      ? `<img src="${escapeHtml(media.dataUrl)}" alt="${escapeHtml(media.name)}" />`
      : `<span class="event-media-file-type">${media.type.startsWith("video/") ? "Video" : media.type.startsWith("audio/") ? "Audio" : "File"}</span>`;
    const removeButton = canEditExperience(activeExperience) || canCollaboratePublicExperience() ? `<button type="button" class="event-media-remove" data-delete-experience-media-id="${escapeHtml(media.id)}" data-experience-location-id="${escapeHtml(location.id)}" aria-label="Delete ${escapeHtml(media.name)}" title="Delete attachment">&times;</button>` : "";
    return `<div class="event-media-avatar" title="${escapeHtml(media.name)}">${avatar}${removeButton}</div>`;
  }).join("")}</div>`;
}

function renderExperienceLocationEditor(location) {
  const attachments = `<label class="event-attachment-picker"><span>Attachments</span><input class="experience-media-input" type="file" accept="image/*,video/*,audio/*" multiple data-experience-location-id="${escapeHtml(location.id)}" /></label>${renderExperienceMediaAvatars(location)}`;
  return `<form class="experience-location-edit-form" data-experience-location-form="${escapeHtml(location.id)}">
  <label>Event name<input name="eventName" value="${escapeHtml(location.eventName || location.label)}" required /></label>
  <label>Location<input name="label" value="${escapeHtml(location.label)}" required /><button type="button" class="secondary-btn event-location-find-btn" data-find-event-location>Find location on map</button></label>
      <label>When<input name="timestamp" type="datetime-local" value="${formatDateTimeInput(location.timestamp)}" required /></label>
      <label>Description<textarea name="description" rows="3" maxlength="500" placeholder="What made this moment memorable?">${escapeHtml(location.description || "")}</textarea></label>
      ${attachments}
      <div class="edit-checkin-actions"><button type="submit" class="primary-btn">Save event</button><button type="button" class="secondary-btn" data-cancel-experience-location-edit>Cancel</button></div>
    </form>`;
}

async function saveExperience(event) {
  event.preventDefault();
  const name = experienceNameInput.value.trim();
  const description = experienceDescriptionInput.value.trim();
  if (!name) return;
  experienceSaveBtn.disabled = true;
  try {
    const id = experienceIdInput.value;
    const sortOrder = Math.max(0, ...experiences.map((experience) => experience.sort_order || 0)) + 1;
    const response = await supabaseRequest(id ? `/rest/v1/${EXPERIENCES_TABLE}?id=eq.${encodeURIComponent(id)}` : `/rest/v1/${EXPERIENCES_TABLE}`, {
      method: id ? "PATCH" : "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name, description, ...(id ? { updated_at: new Date().toISOString() } : { trip_id: currentTrip?.id, is_public: false, public_slug: createPublicSlug(name), sort_order: sortOrder }) }),
    });
    if (!response.ok) throw new Error(await getSupabaseError(response, "Could not save the experience."));
    const [savedExperience] = await response.json();
    activeExperience = savedExperience;
    await loadExperiences();
    resetExperienceForm();
    await openExperience(savedExperience.id);
    setStatus(experienceStatus, id ? "Experience updated." : "Experience created. Add its first event below.", "success");
  } catch (error) {
    setStatus(experienceStatus, error.message, "error");
  } finally {
    experienceSaveBtn.disabled = false;
  }
}

async function addExperienceEvent(event) {
  event.preventDefault();
  const canAddPublicEvent = isPublicExperience && activeExperience?.is_public;
  if (!activeExperience || (!canAddPublicEvent && (!currentTrip || !canEditExperience(activeExperience)))) return;
  const eventName = experienceEventNameInput.value.trim();
  const query = experienceLocationInput.value.trim();
  const timestamp = new Date(experienceTimeInput.value);
  const description = experienceEventDescriptionInput.value.trim();
  if (!eventName || !query || Number.isNaN(timestamp.getTime())) return;
  const files = pendingExperienceEventFiles;
  const oversizedFile = files.find((file) => file.size > MAX_MEDIA_SIZE);
  if (oversizedFile) {
    setStatus(experienceStatus, `${oversizedFile.name} is larger than 5 MB.`, "error");
    return;
  }
  try {
    setStatus(experienceStatus, `Looking up "${query}"…`);
    const foundLocation = experienceEventCreateCoordinates ? { ...experienceEventCreateCoordinates, label: query } : await geocodeLocation(query);
    const { lat, lon, label } = foundLocation;
    const location = { id: createId(), lat, lon, label, eventName, timestamp: timestamp.toISOString(), type: "event", description, media: [], tripId: activeExperience.trip_id || currentTrip?.id, userId: session?.user?.id || activeExperience.user_id };
    const response = canAddPublicEvent
      ? await supabaseRequest("/rest/v1/rpc/checkin_map_add_public_experience_event", { method: "POST", headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ experience_slug: publicExperienceSlug, event_id: location.id, event_name: eventName, event_label: label, event_lat: lat, event_lon: lon, event_timestamp: location.timestamp, event_description: description }) })
      : await supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...mapCheckInToRow(location), experience_id: activeExperience.id }) });
    if (!response.ok) throw new Error(await getSupabaseError(response, "Could not add the event."));
    if (files.length) location.media.push(...await Promise.all(files.map((file) => uploadMediaFile(location, file))));
    experienceLocations.push(location);
    experienceLocationForm.reset();
    pendingExperienceEventFiles = [];
    renderPendingExperienceEventFiles();
    experienceEventCreateCoordinates = null;
    if (experienceEventCreateMarker) experienceEventCreateMap.removeLayer(experienceEventCreateMarker);
    experienceEventCreateMarker = null;
    experienceTimeInput.value = formatDateTimeInput(new Date().toISOString());
    showExperienceScreen("detail");
    renderExperienceLocations();
    renderExperienceMarkers();
    map.flyTo([lat, lon], 12, { duration: 0.45 });
    setStatus(experienceStatus, `${eventName} added as an event.`, "success");
  } catch (error) { setStatus(experienceStatus, error.message, "error"); }
}

function renderExperienceMarkers() {
  experienceLayer.clearLayers();
  experienceMapLayer.clearLayers();
  experienceMarkersByLocationId = new Map();
  experienceLocations.forEach((location) => {
    const popup = `<strong>${escapeHtml(location.eventName || location.label)}</strong><br>${escapeHtml(location.label)}<br>${formatTimestamp(location.timestamp)}${location.description ? `<br>${escapeHtml(location.description)}` : ""}${renderPinMediaCarousel(location)}`;
    const marker = L.marker([location.lat, location.lon]).addTo(experienceLayer).bindPopup(popup);
    marker.on("click", () => map.flyTo([location.lat, location.lon], 12, { duration: 0.45 }));
    const detailMarker = L.marker([location.lat, location.lon]).addTo(experienceMapLayer).bindPopup(popup);
    experienceMarkersByLocationId.set(location.id, detailMarker);
    detailMarker.on("click", () => focusExperienceLocation(location.id, { fromMap: true }));
  });
  fitExperienceMap();
}

function fitExperienceMap() {
  experienceMap.invalidateSize();
  if (!experienceLocations.length) {
    experienceMap.setView([0, 0], 1);
    return;
  }
  experienceMap.fitBounds(L.latLngBounds(experienceLocations.map((location) => [location.lat, location.lon])), { padding: [28, 28], maxZoom: 12 });
}

async function openExperience(id, options = {}) {
  activeExperience = experiences.find((experience) => experience.id === id) || null;
  experienceViewMode = options.edit ? "edit" : "view";
  editingExperienceLocationId = null;
  showExperienceScreen("detail");
  experiencePanel.classList.add("experience-detail-open");
  await loadExperienceLocations();
  renderExperiences();
  window.setTimeout(fitExperienceMap, 0);
  if (experienceLocations.length) map.fitBounds(L.latLngBounds(experienceLocations.map((location) => [location.lat, location.lon])), { padding: [40, 40], maxZoom: 12 });
}

async function deleteExperience(id) {
  const experience = experiences.find((item) => item.id === id);
  if (!experience || !window.confirm(`Delete "${experience.name}" and its location and media?`)) return;
  try {
    const locationsResponse = await supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}?select=*&experience_id=eq.${encodeURIComponent(id)}`);
    if (!locationsResponse.ok) throw new Error(await getSupabaseError(locationsResponse, "Could not delete experience locations."));
    await Promise.all((await locationsResponse.json()).map((row) => deleteCheckInFromSupabase({ ...mapLocationRow(row, new Map()), media: [] })));
    const response = await supabaseRequest(`/rest/v1/${EXPERIENCES_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await getSupabaseError(response, "Could not delete the experience."));
    if (activeExperience?.id === id) { activeExperience = null; experienceLocations = []; experienceLayer.clearLayers(); }
    await loadExperiences();
    setStatus(experienceStatus, "Event deleted.", "success");
  } catch (error) { setStatus(experienceStatus, error.message, "error"); }
}

async function saveExperienceLocation(event) {
  event.preventDefault();
  const form = event.target;
  const id = form.dataset.experienceLocationForm;
  const location = experienceLocations.find((item) => item.id === id);
  const eventName = form.elements.eventName.value.trim();
  const label = form.elements.label.value.trim();
  const timestamp = new Date(form.elements.timestamp.value);
  if (!location || !eventName || !label || Number.isNaN(timestamp.getTime())) return;
  location.eventName = eventName;
  location.label = label;
  location.description = form.elements.description.value.trim();
  location.timestamp = timestamp.toISOString();
  if (experienceEventEditCoordinates) {
    location.lat = experienceEventEditCoordinates.lat;
    location.lon = experienceEventEditCoordinates.lon;
  }
  try {
    const response = isPublicExperience
      ? await supabaseRequest("/rest/v1/rpc/checkin_map_update_public_experience_event", { method: "POST", headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ experience_slug: publicExperienceSlug, event_id: id, event_name: location.eventName, event_label: location.label, event_lat: location.lat, event_lon: location.lon, event_timestamp: location.timestamp, event_description: location.description }) })
      : await supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ event_name: location.eventName, label: location.label, lat: location.lat, lon: location.lon, description: location.description, timestamp: location.timestamp, updated_at: new Date().toISOString() }) });
    if (!response.ok) throw new Error(await getSupabaseError(response, "Could not update the experience location."));
    editingExperienceLocationId = null;
    showExperienceScreen("detail");
    renderExperienceLocations();
    renderExperienceMarkers();
    setStatus(experienceStatus, "Location updated.", "success");
  } catch (error) { setStatus(experienceStatus, error.message, "error"); }
}

async function handleExperienceMediaAttachment(event) {
  const input = event.target;
  const location = experienceLocations.find((item) => item.id === input.dataset.experienceLocationId);
  if (!location || !input.files.length) return;
  const files = Array.from(input.files).slice(0, MAX_MEDIA_FILES - location.media.length);
  const oversizedFile = files.find((file) => file.size > MAX_MEDIA_SIZE);
  if (oversizedFile) { setStatus(experienceStatus, `${oversizedFile.name} is larger than 5 MB.`, "error"); input.value = ""; return; }
  try {
    setStatus(experienceStatus, "Uploading media…");
    location.media.push(...await Promise.all(files.map((file) => uploadMediaFile(location, file))));
    renderExperienceLocations();
    renderExperienceMarkers();
    setStatus(experienceStatus, "Media attached to this location.", "success");
  } catch (error) { setStatus(experienceStatus, error.message, "error"); }
  finally { input.value = ""; }
}

function focusExperienceLocation(id, options = {}) {
  const location = experienceLocations.find((item) => item.id === id);
  if (!location) return;
  if (!options.fromMap) experienceMap.flyTo([location.lat, location.lon], 12, { duration: 0.45 });
  experienceLocationList.querySelectorAll(".experience-location-card").forEach((card) => card.classList.toggle("selected", card.dataset.experienceLocationId === id));
  experienceMarkersByLocationId.forEach((marker, locationId) => marker.getElement()?.classList.toggle("experience-marker-active", locationId === id));
  const detailMarker = experienceMarkersByLocationId.get(id);
  if (detailMarker) {
    experienceMap.panTo([location.lat, location.lon], { animate: true, duration: 0.45 });
    detailMarker.openPopup();
  }
  let markerIndex = 0;
  experienceLayer.eachLayer((marker) => {
    if (experienceLocations[markerIndex]?.id === id) marker.openPopup();
    markerIndex += 1;
  });
}

function closeExperiences() {
  experiencePanel.hidden = true;
  experiencePanel.classList.remove("trip-panel-open");
  experiencePanel.classList.remove("experience-detail-open");
  activeExperience = null;
  experienceLocations = [];
  experienceLayer.clearLayers();
  showExperienceScreen("index");
  resetExperienceForm();
  unlockTripPageScroll();
  if (session && !isExperienceUrl) showWelcome();
}

function openExperienceEventForm() {
  const canAddPublicEvent = isPublicExperience && activeExperience?.is_public;
  if (!activeExperience || (!canAddPublicEvent && !canEditExperience(activeExperience))) return;
  experienceLocationForm.reset();
  pendingExperienceEventFiles = [];
  renderPendingExperienceEventFiles();
  experienceTimeInput.value = formatDateTimeInput(new Date().toISOString());
  experienceEventCreateCoordinates = null;
  if (experienceEventCreateMarker) experienceEventCreateMap.removeLayer(experienceEventCreateMarker);
  experienceEventCreateMarker = null;
  showExperienceScreen("eventCreate");
  experienceLocationForm.hidden = false;
  experienceEventMediaInput.closest(".event-attachment-picker").hidden = isPublicExperience;
  experienceEventMediaPreview.hidden = isPublicExperience;
  window.setTimeout(() => experienceEventCreateMap.invalidateSize(), 0);
  experienceLocationInput.focus();
}

function closeExperienceEventCreate() {
  experienceLocationForm.reset();
  pendingExperienceEventFiles = [];
  renderPendingExperienceEventFiles();
  experienceEventCreateCoordinates = null;
  if (experienceEventCreateMarker) experienceEventCreateMap.removeLayer(experienceEventCreateMarker);
  experienceEventCreateMarker = null;
  experienceLocationForm.hidden = true;
  showExperienceScreen("detail");
}

function setExperienceEventCreateLocation(lat, lon, label) {
  experienceLocationInput.value = label;
  experienceEventCreateCoordinates = { lat, lon };
  experienceEventCreateMap.invalidateSize();
  experienceEventCreateMap.setView([lat, lon], 11);
  if (experienceEventCreateMarker) experienceEventCreateMap.removeLayer(experienceEventCreateMarker);
  experienceEventCreateMarker = L.marker([lat, lon]).addTo(experienceEventCreateMap);
}

async function findNewExperienceEventLocation() {
  const query = experienceLocationInput.value.trim();
  if (!query) return;
  try {
    const { lat, lon, label } = await geocodeLocation(query);
    setExperienceEventCreateLocation(lat, lon, label);
  } catch (error) { setStatus(experienceStatus, error.message, "error"); }
}

experienceEventCreateMap.on("click", async (event) => {
  try {
    const label = await reverseGeocodeLocation(event.latlng.lat, event.latlng.lng);
    setExperienceEventCreateLocation(event.latlng.lat, event.latlng.lng, label);
  } catch (error) { setStatus(experienceStatus, error.message, "error"); }
});

function renderPendingExperienceEventFiles() {
  experienceEventMediaPreview.innerHTML = pendingExperienceEventFiles.map((file, index) => {
    const preview = file.type.startsWith("image/")
      ? `<img src="${escapeHtml(URL.createObjectURL(file))}" alt="${escapeHtml(file.name)}" />`
      : `<span class="event-media-file-type">${file.type.startsWith("video/") ? "Video" : file.type.startsWith("audio/") ? "Audio" : "File"}</span>`;
    return `<div class="event-media-avatar" title="${escapeHtml(file.name)}">${preview}<button type="button" class="event-media-remove" data-remove-pending-event-media="${index}" aria-label="Remove ${escapeHtml(file.name)}">&times;</button></div>`;
  }).join("");
}

function openExperienceDetailsForm() {
  if (!activeExperience || !canEditExperience(activeExperience)) return;
  experienceIdInput.value = activeExperience.id;
  experienceNameInput.value = activeExperience.name;
  experienceDescriptionInput.value = activeExperience.description || "";
  experienceSaveBtn.textContent = "Save";
  showExperienceScreen("create");
  experienceNameInput.focus();
}

async function handleExperienceClick(event) {
  const card = event.target.closest(".experience-card");
  if (card && !event.target.closest("button, input, label")) {
    const experience = experiences.find((item) => item.id === card.dataset.experienceId);
    if (!experience) return;
    if (experience.public_slug) {
      window.open(`${window.location.origin}${window.location.pathname}?experience=${encodeURIComponent(experience.public_slug)}`, "_blank", "noopener");
      return;
    }
    const experienceTab = window.open("about:blank", "_blank");
    if (!experienceTab) {
      setStatus(experienceStatus, "Your browser blocked the Experience tab.", "error");
      return;
    }
    experienceTab.opener = null;
    try {
      const url = await experienceUrl(experience);
      experienceTab.location.replace(url);
    } catch (error) {
      experienceTab.close();
      setStatus(experienceStatus, error.message, "error");
    }
    return;
  }
  const editButton = event.target.closest("[data-edit-experience]");
  if (editButton) {
    const experience = experiences.find((item) => item.id === editButton.dataset.editExperience);
    if (!experience) return;
    await openExperience(experience.id, { edit: true });
    return;
  }
  const moveButton = event.target.closest("[data-move-experience]");
  if (moveButton) {
    try { await moveExperience(moveButton.dataset.experienceId, moveButton.dataset.moveExperience); }
    catch (error) { setStatus(experienceStatus, error.message, "error"); }
    return;
  }
  const duplicateButton = event.target.closest("[data-duplicate-experience]");
  if (duplicateButton) {
    try { await duplicateExperience(duplicateButton.dataset.duplicateExperience); }
    catch (error) { setStatus(experienceStatus, error.message, "error"); }
    return;
  }
  const deleteButton = event.target.closest("[data-delete-experience]");
  if (deleteButton) deleteExperience(deleteButton.dataset.deleteExperience);
  const copyButton = event.target.closest("[data-copy-experience]");
  if (copyButton) {
    try { await copyExperienceUrl(copyButton.dataset.copyExperience); }
    catch (error) { setStatus(experienceStatus, error.message, "error"); }
  }
}

async function duplicateExperience(id) {
  const source = experiences.find((experience) => experience.id === id);
  if (!source || !canEditExperience(source) || !session?.user?.id) return;
  const copyName = `${source.name} - copy`;
  const sortOrder = Math.max(0, ...experiences.map((experience) => experience.sort_order || 0)) + 1;
  setStatus(experienceStatus, `Duplicating "${source.name}"…`);
  const experienceResponse = await supabaseRequest(`/rest/v1/${EXPERIENCES_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name: copyName, description: source.description || "", trip_id: source.trip_id || currentTrip?.id, user_id: session.user.id, is_public: false, public_slug: createPublicSlug(copyName), sort_order: sortOrder }),
  });
  if (!experienceResponse.ok) throw new Error(await getSupabaseError(experienceResponse, "Could not duplicate the experience."));
  const [copy] = await experienceResponse.json();
  try {
    const locationsResponse = await supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}?select=*&experience_id=eq.${encodeURIComponent(source.id)}&order=timestamp.asc`);
    if (!locationsResponse.ok) throw new Error(await getSupabaseError(locationsResponse, "Could not load the experience events."));
    const locations = await locationsResponse.json();
    if (locations.length) {
      const eventResponse = await supabaseRequest(`/rest/v1/${LOCATIONS_TABLE}`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(locations.map((location) => ({
          id: createId(),
          lat: location.lat,
          lon: location.lon,
          label: location.label,
          event_name: location.event_name,
          description: location.description || "",
          timestamp: location.timestamp,
          type: location.type || "event",
          trip_id: copy.trip_id || currentTrip?.id,
          user_id: session.user.id,
          experience_id: copy.id,
          preview_url: location.preview_url || null,
          updated_at: new Date().toISOString(),
        }))),
      });
      if (!eventResponse.ok) throw new Error(await getSupabaseError(eventResponse, "Could not duplicate the experience events."));
    }
  } catch (error) {
    await supabaseRequest(`/rest/v1/${EXPERIENCES_TABLE}?id=eq.${encodeURIComponent(copy.id)}`, { method: "DELETE" });
    throw error;
  }
  await loadExperiences();
  await openExperience(copy.id, { edit: true });
  setStatus(experienceStatus, `Created "${copyName}".`, "success");
}

async function updateExperienceSharing(id, isPublic) {
  const experience = experiences.find((item) => item.id === id);
  if (!experience || !canEditExperience(experience)) return;
  const publicSlug = experience.public_slug || createPublicSlug(experience.name);
  const response = await supabaseRequest(`/rest/v1/${EXPERIENCES_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_public: isPublic, public_slug: publicSlug, updated_at: new Date().toISOString() }) });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not update sharing."));
  experience.is_public = isPublic;
  experience.public_slug = publicSlug;
  if (activeExperience?.id === id) activeExperience = experience;
  renderExperiences();
  setStatus(experienceStatus, isPublic ? "Experience is public." : "Experience is private.", "success");
}

async function copyExperienceUrl(id) {
  const experience = experiences.find((item) => item.id === id);
  if (!experience || !canEditExperience(experience)) return;
  await navigator.clipboard.writeText(await experienceUrl(experience));
  setStatus(experienceStatus, experience.is_public ? "Public experience URL copied." : "Private experience URL copied. It requires owner sign-in.", "success");
}

async function experienceUrl(experience) {
  const slug = experience.public_slug || createPublicSlug(experience.name);
  if (!experience.public_slug) {
    const response = await supabaseRequest(`/rest/v1/${EXPERIENCES_TABLE}?id=eq.${encodeURIComponent(experience.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ public_slug: slug, updated_at: new Date().toISOString() }) });
    if (!response.ok) throw new Error(await getSupabaseError(response, "Could not create the experience URL."));
    experience.public_slug = slug;
  }
  return `${window.location.origin}${window.location.pathname}?experience=${encodeURIComponent(slug)}`;
}

async function handleExperienceChange(event) {
  const toggle = event.target.closest("[data-experience-public]");
  if (!toggle) return;
  try { await updateExperienceSharing(toggle.dataset.experiencePublic, toggle.checked); }
  catch (error) { setStatus(experienceStatus, error.message, "error"); }
}

async function handleExperienceLocationClick(event) {
  const deleteMediaButton = event.target.closest("[data-delete-experience-media-id]");
  if (deleteMediaButton) {
    event.preventDefault();
    event.stopPropagation();
    await deleteExperienceMedia(deleteMediaButton.dataset.experienceLocationId, deleteMediaButton.dataset.deleteExperienceMediaId);
    return;
  }
  const showButton = event.target.closest("[data-show-experience-location]");
  if (showButton) { focusExperienceLocation(showButton.dataset.showExperienceLocation); return; }
  const card = event.target.closest("[data-experience-location-id]");
  if (card && !event.target.closest("button, input, label")) {
    focusExperienceLocation(card.dataset.experienceLocationId);
    return;
  }
  const editButton = event.target.closest("[data-edit-experience-location]");
  if (editButton) { openExperienceEventEdit(editButton.dataset.editExperienceLocation); return; }
  const deleteButton = event.target.closest("[data-delete-experience-location]");
  if (deleteButton) {
    const location = experienceLocations.find((item) => item.id === deleteButton.dataset.deleteExperienceLocation);
    if (!location || !window.confirm(`Delete ${location.label} and its attached media?`)) return;
    try {
      await deleteCheckInFromSupabase(location);
      experienceLocations = experienceLocations.filter((item) => item.id !== location.id);
      renderExperienceLocations();
      renderExperienceMarkers();
      setStatus(experienceStatus, "Location deleted.", "success");
    } catch (error) { setStatus(experienceStatus, error.message, "error"); }
    return;
  }
  handleMapPopupAction(event);
}

function openExperienceEventEdit(id) {
  const location = experienceLocations.find((item) => item.id === id);
  const canEditPublicEvent = isPublicExperience && activeExperience?.is_public;
  if (!location || (!canEditPublicEvent && !canEditExperience(activeExperience))) return;
  editingExperienceLocationId = id;
  experienceEventEditName.textContent = location.eventName || location.label;
  experienceEventEditContent.innerHTML = renderExperienceLocationEditor(location);
  showExperienceScreen("eventEdit");
  experiencePanel.classList.add("experience-event-edit-open");
  experienceEventEditMapElement.hidden = true;
  experienceEventEditCoordinates = { lat: location.lat, lon: location.lon };
  experienceEventEditContent.querySelector("input[name=label]")?.focus();
}

function closeExperienceEventEdit() {
  editingExperienceLocationId = null;
  experienceEventEditCoordinates = null;
  if (experienceEventEditMarker) experienceEventEditMap.removeLayer(experienceEventEditMarker);
  experienceEventEditMarker = null;
  experienceEventEditMapElement.hidden = true;
  experiencePanel.classList.remove("experience-event-edit-open");
  showExperienceScreen("detail");
  renderExperienceLocations();
}

function renderExperienceEventEditMap() {
  if (!experienceEventEditCoordinates) return;
  experienceEventEditMap.invalidateSize();
  experienceEventEditMap.setView([experienceEventEditCoordinates.lat, experienceEventEditCoordinates.lon], 11);
  if (experienceEventEditMarker) experienceEventEditMap.removeLayer(experienceEventEditMarker);
  experienceEventEditMarker = L.marker([experienceEventEditCoordinates.lat, experienceEventEditCoordinates.lon]).addTo(experienceEventEditMap);
}

async function findExperienceEventLocation() {
  const input = experienceEventEditContent.querySelector("input[name=label]");
  const query = input?.value.trim();
  try {
    if (query) {
      const { lat, lon, label } = await geocodeLocation(query);
      input.value = label;
      experienceEventEditCoordinates = { lat, lon };
    }
    experienceEventEditMapElement.hidden = false;
    renderExperienceEventEditMap();
  } catch (error) { setStatus(experienceStatus, error.message, "error"); }
}

experienceEventEditMap.on("click", async (event) => {
  try {
    const label = await reverseGeocodeLocation(event.latlng.lat, event.latlng.lng);
    const input = experienceEventEditContent.querySelector("input[name=label]");
    if (input) input.value = label;
    experienceEventEditCoordinates = { lat: event.latlng.lat, lon: event.latlng.lng };
    renderExperienceEventEditMap();
  } catch (error) { setStatus(experienceStatus, error.message, "error"); }
});

function renderTripSelect() {
  tripListEl.innerHTML = trips.map((trip, index) => `<article class="trip-card${currentTrip?.id === trip.id ? " active" : ""}" data-trip-id="${escapeHtml(trip.id)}" draggable="${canEditTrip()}"><div class="trip-card-main"><div><p class="panel-kicker">${trip.is_public ? "Public trip" : "Private trip"}${index === 0 ? " · Default on login" : ""}</p><h3>${escapeHtml(trip.name)}</h3><p class="trip-card-meta">Created ${formatTimestamp(trip.created_at)}</p></div><button type="button" class="primary-btn trip-open-btn" data-open-trip="${escapeHtml(trip.id)}">Open</button></div>${canEditTrip() ? `<div class="trip-card-edit"><div class="trip-order-controls" aria-label="Reorder ${escapeHtml(trip.name)}"><button type="button" class="secondary-btn icon-btn" data-move-trip="up" data-trip-id="${escapeHtml(trip.id)}" aria-label="Move ${escapeHtml(trip.name)} up" title="Move up" ${index === 0 ? "disabled" : ""}>&uarr;</button><button type="button" class="secondary-btn icon-btn" data-move-trip="down" data-trip-id="${escapeHtml(trip.id)}" aria-label="Move ${escapeHtml(trip.name)} down" title="Move down" ${index === trips.length - 1 ? "disabled" : ""}>&darr;</button></div><button type="button" class="secondary-btn" data-rename-trip="${escapeHtml(trip.id)}">Rename</button><button type="button" class="secondary-btn" data-save-trip="${escapeHtml(trip.id)}">Save</button><label class="public-toggle"><input type="checkbox" ${trip.is_public ? "checked" : ""} data-trip-public="${escapeHtml(trip.id)}" /><span>Public</span></label>${trip.is_public ? `<button type="button" class="secondary-btn" data-copy-trip="${escapeHtml(trip.id)}">Copy URL <span class="button-icon" aria-hidden="true">⧉</span></button>` : ""}<button type="button" class="delete-checkin-btn" data-delete-trip="${escapeHtml(trip.id)}" aria-label="Delete ${escapeHtml(trip.name)}" title="Delete trip">&times;</button></div>` : ""}</article>`).join("");
}

async function moveTrip(tripId, direction) {
  const currentIndex = trips.findIndex((trip) => trip.id === tripId);
  const targetIndex = currentIndex + (direction === "up" ? -1 : 1);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= trips.length || !canEditTrip()) return;

  const reorderedTrips = [...trips];
  [reorderedTrips[currentIndex], reorderedTrips[targetIndex]] = [reorderedTrips[targetIndex], reorderedTrips[currentIndex]];
  await saveTripOrder(reorderedTrips);
}

async function saveTripOrder(reorderedTrips) {
  const responses = await Promise.all(reorderedTrips.map((trip, index) => supabaseRequest(
    `/rest/v1/${TRIPS_TABLE}?id=eq.${encodeURIComponent(trip.id)}`,
    { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sort_order: index + 1 }) }
  )));
  const failedResponse = responses.find((response) => !response.ok);
  if (failedResponse) throw new Error(await getSupabaseError(failedResponse, "Could not reorder trips."));

  trips = reorderedTrips.map((trip, index) => ({ ...trip, sort_order: index + 1 }));
  currentTrip = trips.find((trip) => trip.id === currentTrip?.id) || null;
  renderTripSelect();
  setStatus(tripStatus, "Trip order saved.", "success");
}

function clearTripDragState() {
  draggedTripId = null;
  tripListEl.querySelectorAll(".is-dragging, .drag-over-before, .drag-over-after").forEach((card) => card.classList.remove("is-dragging", "drag-over-before", "drag-over-after"));
}

function handleTripDragStart(event) {
  const card = event.target.closest('.trip-card[draggable="true"]');
  if (!card || event.target.closest("button, input, label")) {
    event.preventDefault();
    return;
  }
  draggedTripId = card.dataset.tripId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedTripId);
  card.classList.add("is-dragging");
}

function handleTripDragOver(event) {
  if (!draggedTripId) return;
  const card = event.target.closest(".trip-card");
  if (!card || card.dataset.tripId === draggedTripId) return;
  event.preventDefault();
  tripListEl.querySelectorAll(".drag-over-before, .drag-over-after").forEach((item) => item.classList.remove("drag-over-before", "drag-over-after"));
  card.classList.add(event.clientY < card.getBoundingClientRect().top + card.offsetHeight / 2 ? "drag-over-before" : "drag-over-after");
  event.dataTransfer.dropEffect = "move";
}

async function handleTripDrop(event) {
  const targetCard = event.target.closest(".trip-card");
  if (!draggedTripId || !targetCard || targetCard.dataset.tripId === draggedTripId) return;
  event.preventDefault();
  const sourceIndex = trips.findIndex((trip) => trip.id === draggedTripId);
  let targetIndex = trips.findIndex((trip) => trip.id === targetCard.dataset.tripId);
  if (event.clientY >= targetCard.getBoundingClientRect().top + targetCard.offsetHeight / 2) targetIndex += 1;
  const reorderedTrips = [...trips];
  const [draggedTrip] = reorderedTrips.splice(sourceIndex, 1);
  if (sourceIndex < targetIndex) targetIndex -= 1;
  reorderedTrips.splice(targetIndex, 0, draggedTrip);
  try {
    await saveTripOrder(reorderedTrips);
  } catch (error) {
    setStatus(tripStatus, error.message, "error");
  } finally {
    clearTripDragState();
  }
}

async function saveTripCard(tripId) {
  const trip = trips.find((item) => item.id === tripId);
  if (!trip || !canEditTrip()) return;
  const isPublic = tripListEl.querySelector(`[data-trip-public="${CSS.escape(tripId)}"]`).checked;
  const publicSlug = trip.public_slug || createPublicSlug(trip.name);
  const response = await supabaseRequest(`/rest/v1/${TRIPS_TABLE}?id=eq.${encodeURIComponent(tripId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ name: trip.name, is_public: isPublic, public_slug: publicSlug }) });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not update the trip."));
  trip.is_public = isPublic;
  trip.public_slug = publicSlug;
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
  const publicToggle = event.target.closest("[data-trip-public]");
  if (publicToggle && event.type === "change") {
    try { await saveTripCard(publicToggle.dataset.tripPublic); } catch (error) { setStatus(tripStatus, error.message, "error"); }
    return;
  }

  const openButton = event.target.closest("[data-open-trip]");
  if (openButton) {
    currentTrip = trips.find((trip) => trip.id === openButton.dataset.openTrip);
    await loadCheckIns();
    renderCheckInList();
    renderCheckInMarkers();
    renderTripSelect();
    updateCheckInTripName();
    tripPanel.hidden = true;
    tripPanel.classList.remove("trip-panel-open");
    unlockTripPageScroll();
    fitMapToCheckIns();
    setStatus(checkInStatus, `Opened trip "${currentTrip.name}".`, "success");
    return;
  }
  const moveButton = event.target.closest("[data-move-trip]");
  if (moveButton) {
    try { await moveTrip(moveButton.dataset.tripId, moveButton.dataset.moveTrip); } catch (error) { setStatus(tripStatus, error.message, "error"); }
    return;
  }
  const saveButton = event.target.closest("[data-save-trip]");
  if (saveButton) {
    try { await saveTripCard(saveButton.dataset.saveTrip); } catch (error) { setStatus(tripStatus, error.message, "error"); }
    return;
  }
  const renameButton = event.target.closest("[data-rename-trip]");
  if (renameButton) {
    openRenameTripScreen(renameButton.dataset.renameTrip);
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
    eventName: row.event_name || "",
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
    event_name: checkIn.eventName || null,
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

async function deleteStoredMedia(media, options = {}) {
  if (!media.storagePath) return;
  const response = await supabaseRequest(`/storage/v1/object/${encodeURIComponent(STORAGE_BUCKET)}/${media.storagePath.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE", ...options });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not remove attached media from Supabase."));
}

async function deleteExperienceMedia(locationId, mediaId) {
  const location = experienceLocations.find((item) => item.id === locationId);
  const media = location?.media.find((item) => item.id === mediaId);
  if (!location || !media || (!canEditExperience(activeExperience) && !canCollaboratePublicExperience())) return;
  try {
    const publicRequest = canCollaboratePublicExperience() ? { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } } : {};
    const response = await supabaseRequest(`/rest/v1/${MEDIA_TABLE}?id=eq.${encodeURIComponent(media.id)}`, { method: "DELETE", ...publicRequest });
    if (!response.ok) throw new Error(await getSupabaseError(response, "Could not delete the attachment."));
    location.media = location.media.filter((item) => item.id !== media.id);
    renderExperienceLocations();
    renderExperienceMarkers();
    setStatus(experienceStatus, "Attachment deleted.", "success");
    deleteStoredMedia(media, publicRequest).catch(() => {});
  } catch (error) { setStatus(experienceStatus, error.message, "error"); }
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
  checkIn.userId = session.user.id;
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

function canEditExperience(experience) {
  return Boolean(session && experience && (isAdmin() || experience.user_id === session.user.id));
}

function canCollaboratePublicExperience() {
  return Boolean(isPublicExperience && activeExperience?.is_public);
}

function updateCheckInTripName() {
  checkInTripName.textContent = currentTrip ? `Trip: ${currentTrip.name}` : "";
}

function renderCheckInList() {
  updateCheckInTripName();
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
        return `<img class="attached-media-preview" src="${escapeHtml(media.dataUrl)}" alt="Attached image" />`;
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
    const marker = L.marker([checkIn.lat, checkIn.lon], checkIn.type === "photo" ? { icon: photoIcon(checkIn.previewUrl) } : {})
      .addTo(checkInLayer)
      .bindPopup(`<strong>${checkIn.type === "photo" ? "Photo" : "Check-in"}</strong><br>${escapeHtml(checkIn.label)}<br>${formatTimestamp(checkIn.timestamp)}${renderPinMediaCarousel(checkIn)}${canEditCheckIn(checkIn) ? `<br><button type="button" class="map-delete-btn" data-delete-checkin-id="${escapeHtml(checkIn.id)}">Delete pin</button>` : ""}`);
    marker.on("click", () => map.flyTo([checkIn.lat, checkIn.lon], 12, { duration: 0.45 }));
  });
}

function fitMapToCheckIns() {
  if (checkIns.length === 0) return;
  const bounds = L.latLngBounds(checkIns.map((checkIn) => [checkIn.lat, checkIn.lon]));
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
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
      return `<div class="pin-media-slide${index === 0 ? " active" : ""}" data-slide-index="${index}" data-media-url="${escapeHtml(media.dataUrl)}" data-media-type="${escapeHtml(media.type)}" data-media-name="${escapeHtml(media.name)}">${content}</div>`;
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
  mediaViewerName.textContent = "";
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
  const isPublicAttachment = canCollaboratePublicExperience();
  const storagePath = isPublicAttachment
    ? `public-events/${checkIn.id}/${createId()}-${safeName}`
    : `${session.user.id}/${checkIn.id}/${createId()}-${safeName}`;
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await supabaseRequest(`/storage/v1/object/${encodeURIComponent(STORAGE_BUCKET)}/${encodedPath}`, {
    method: "POST",
    headers: { ...(isPublicAttachment ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}), "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
    body: file,
  });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not upload media to Supabase Storage."));

  const publicUrl = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(STORAGE_BUCKET)}/${encodedPath}`;
  const media = { id: createId(), name: file.name, type: file.type || "application/octet-stream", storagePath, dataUrl: publicUrl };
  const metadataResponse = await supabaseRequest(`/rest/v1/${MEDIA_TABLE}`, {
    method: "POST",
    headers: { ...(isPublicAttachment ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}), Prefer: "return=minimal" },
    body: JSON.stringify({
      id: media.id,
      checkin_id: checkIn.id,
      user_id: isPublicAttachment ? null : session.user.id,
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
  profileStatusInput.value = profile.status || "";
  profileUrlInput.value = profile.profile_url || "";
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

function openNewTripScreen() {
  tripPanel.hidden = true;
  newTripPanel.hidden = false;
  newTripPanel.classList.add("profile-panel-open");
  newTripNameInput.focus();
}

function closeNewTripScreen() {
  newTripPanel.hidden = true;
  newTripPanel.classList.remove("profile-panel-open");
  newTripNameInput.value = "";
  setStatus(newTripStatus, "");
  tripPanel.hidden = false;
}

function openRenameTripScreen(tripId) {
  const trip = trips.find((item) => item.id === tripId);
  if (!trip || !canEditTrip()) return;
  currentTrip = trip;
  tripPanel.hidden = true;
  renameTripPanel.hidden = false;
  renameTripNameInput.value = trip.name;
  renameTripNameInput.focus();
}

function closeRenameTripScreen() {
  renameTripPanel.hidden = true;
  renameTripNameInput.value = "";
  setStatus(renameTripStatus, "");
  tripPanel.hidden = false;
}

async function saveRenamedTrip(event) {
  event.preventDefault();
  const name = renameTripNameInput.value.trim();
  if (!name || !currentTrip || !canEditTrip()) return;
  try {
    const response = await supabaseRequest(`/rest/v1/${TRIPS_TABLE}?id=eq.${encodeURIComponent(currentTrip.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ name }) });
    if (!response.ok) throw new Error(await getSupabaseError(response, "Could not rename the trip."));
    currentTrip.name = name;
    const trip = trips.find((item) => item.id === currentTrip.id);
    if (trip) trip.name = name;
    updateCheckInTripName();
    renderTripSelect();
    closeRenameTripScreen();
    setStatus(tripStatus, "Trip renamed.", "success");
  } catch (error) {
    setStatus(renameTripStatus, error.message, "error");
  }
}

async function saveNewTrip(event) {
  event.preventDefault();
  const name = newTripNameInput.value.trim();
  if (!name) return;
  try {
    const trip = await createTripRecord(name);
    trips.push(trip);
    currentTrip = trip;
    updateCheckInTripName();
    renderTripSelect();
    await loadCheckIns();
    renderCheckInList();
    renderCheckInMarkers();
    closeNewTripScreen();
    setStatus(tripStatus, `Trip "${trip.name}" created.`, "success");
  } catch (error) {
    setStatus(newTripStatus, error.message, "error");
  }
}

async function createTripRecord(name) {
  const sortOrder = Math.max(0, ...trips.map((trip) => trip.sort_order || 0)) + 1;
  const response = await supabaseRequest(`/rest/v1/${TRIPS_TABLE}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name, is_public: false, public_slug: createPublicSlug(name), sort_order: sortOrder }) });
  if (!response.ok) throw new Error(await getSupabaseError(response, "Could not create trip."));
  const [trip] = await response.json();
  return trip;
}

function updateAvatar(url) {
  userAvatar.src = url || "";
  userAvatar.hidden = !url;
}

function setAuthUi(isAuthenticated, options = {}) {
  const { keepAppVisible = false } = options;
  loginBtn.hidden = isAuthenticated;
  createProfileBtn.hidden = isAuthenticated;
  profileBtn.hidden = !isAuthenticated;
  tripsBtn.hidden = !isAuthenticated;
  experiencesBtn.hidden = !isAuthenticated;
  signOutBtn.hidden = !isAuthenticated;
  if (!isAuthenticated) {
    userStatus.textContent = "Sign in to continue";
    updateAvatar("");
    if (!keepAppVisible) appContent.hidden = true;
    authPanel.hidden = true;
    closeProfile();
    tripPanel.hidden = true;
    experiencePanel.hidden = true;
    experienceLayer.clearLayers();
    unlockTripPageScroll();
  } else {
    appContent.hidden = false;
  }
}

function setLoggedOutPreview(enabled) {
  document.body.classList.toggle("logged-out-preview", enabled);
  loggedOutPreviewImage.hidden = !enabled;
  if (enabled) {
    appContent.hidden = false;
    setStatus(checkInStatus, "");
  }
}

function showWelcome() {
  welcomePanel.hidden = false;
}

function closeWelcome() {
  welcomePanel.hidden = true;
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
  const status = profileStatusInput.value.trim();
  const profileUrl = profileUrlInput.value.trim();
  const avatarFile = profileAvatarInput.files[0];
  let avatarUrl = profile.avatar_url || null;
  if (avatarFile) avatarUrl = await uploadAvatar(avatarFile);
  const response = await supabaseRequest(`/rest/v1/${PROFILES_TABLE}?id=eq.${encodeURIComponent(session.user.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ display_name: displayName, status, profile_url: profileUrl || null, avatar_url: avatarUrl }),
  });
  if (!response.ok) {
    const error = await getSupabaseError(response, "Could not save your profile.");
    if (/avatar_url|status|profile_url.*schema cache|column.*(avatar_url|status|profile_url)/i.test(error)) {
      throw new Error("Your Supabase schema needs the profile fields update. Run experiences_app/supabase-schema.sql, then refresh the app.");
    }
    throw new Error(error);
  }
  profile.display_name = displayName;
  profile.status = status;
  profile.profile_url = profileUrl || null;
  profile.avatar_url = avatarUrl;
  userStatus.textContent = profile.username || profile.display_name;
  updateAvatar(avatarUrl);
  profileAvatarPreview.src = avatarUrl || "";
  profileAvatarInput.value = "";
  setStatus(profileStatus, "Profile saved.", "success");
}

async function enterApp(nextSession) {
  session = nextSession;
  setLoggedOutPreview(false);
  document.body.classList.remove("public-trip-view");
  await loadProfile();
  authPanel.hidden = true;
  appContent.hidden = false;
  setAuthUi(true);
  userStatus.textContent = profile.username || profile.display_name;
  updateAvatar(profile.avatar_url);
  adminPanel.hidden = profile.role !== "admin";
  await loadTrips();
  if (!currentTrip) {
    await createTripRecord("My first trip");
    await loadTrips();
  }
  await loadExperiences();
  await loadCheckIns();
  renderCheckInList();
  renderCheckInMarkers();
  renderPhotoList();
  updateClearCheckInsButton();
  if (profile.role === "admin") await loadAdminData();
  showWelcome();
  window.setTimeout(() => {
    map.invalidateSize();
    fitMapToCheckIns();
  }, 0);
}

function setAuthMode(mode) {
  const shouldHide = authMode === mode && !authPanel.hidden;
  authMode = mode;
  authPanel.hidden = shouldHide;
  loginBtn.classList.toggle("is-active", authMode === "signin" && !authPanel.hidden);
  createProfileBtn.classList.toggle("is-active", authMode === "signup" && !authPanel.hidden);
  authModeLabel.textContent = authMode === "signin" ? "Log in" : "Create account";
  authSubmitBtn.textContent = authMode === "signin" ? "Log in" : "Create account";
  if (!authPanel.hidden && authUsername.value) authUsername.focus();
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
loginBtn.addEventListener("click", () => setAuthMode("signin"));
createProfileBtn.addEventListener("click", () => setAuthMode("signup"));
welcomeNewTripBtn.addEventListener("click", () => {
  closeWelcome();
  openNewTripScreen();
});
welcomeExploreBtn.addEventListener("click", async () => {
  closeWelcome();
  try {
    await loadExperiences();
    experiencePanel.hidden = false;
    experiencePanel.classList.add("trip-panel-open");
    lockTripPageScroll();
    showExperienceIndex();
  } catch (error) { setStatus(checkInStatus, error.message, "error"); }
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
  lockTripPageScroll();
  tripListEl.querySelector(".trip-card.active")?.focus();
});
experiencesBtn.addEventListener("click", async () => {
  try {
    await loadExperiences();
    experiencePanel.hidden = false;
    experiencePanel.classList.add("trip-panel-open");
    lockTripPageScroll();
    showExperienceIndex();
  } catch (error) { setStatus(checkInStatus, error.message, "error"); }
});
closeTripsBtn.addEventListener("click", () => {
  tripPanel.hidden = true;
  tripPanel.classList.remove("trip-panel-open");
  unlockTripPageScroll();
});
closeExperiencesBtn.addEventListener("click", closeExperiences);
newExperienceBtn.addEventListener("click", showExperienceCreate);
backFromExperienceCreateBtn.addEventListener("click", showExperienceIndex);
experienceDoneBtn.addEventListener("click", showExperienceIndex);
experienceEditDetailsBtn.addEventListener("click", openExperienceDetailsForm);
activeExperienceName.addEventListener("click", openExperienceDetailsForm);
newExperienceEventBtn.addEventListener("click", openExperienceEventForm);
backFromExperienceEventCreateBtn.addEventListener("click", closeExperienceEventCreate);
experienceForm.addEventListener("submit", saveExperience);
experienceLocationForm.addEventListener("submit", addExperienceEvent);
findExperienceEventLocationBtn.addEventListener("click", findNewExperienceEventLocation);
experienceLocationInput.addEventListener("input", () => {
  experienceEventCreateCoordinates = null;
});
experienceEventMediaInput.addEventListener("change", () => {
  const files = Array.from(experienceEventMediaInput.files);
  pendingExperienceEventFiles.push(...files.slice(0, MAX_MEDIA_FILES - pendingExperienceEventFiles.length));
  experienceEventMediaInput.value = "";
  renderPendingExperienceEventFiles();
});
experienceEventMediaPreview.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-pending-event-media]");
  if (!removeButton) return;
  pendingExperienceEventFiles.splice(Number(removeButton.dataset.removePendingEventMedia), 1);
  renderPendingExperienceEventFiles();
});
experienceList?.addEventListener("click", handleExperienceClick);
experienceList?.addEventListener("change", handleExperienceChange);
experienceList?.addEventListener("dragstart", handleExperienceDragStart);
experienceList?.addEventListener("dragover", handleExperienceDragOver);
experienceList?.addEventListener("drop", handleExperienceDrop);
experienceList?.addEventListener("dragend", clearExperienceDragState);
experienceLocationList?.addEventListener("click", handleExperienceLocationClick);
experienceLocationList?.addEventListener("submit", saveExperienceLocation);
experienceLocationList?.addEventListener("change", (event) => {
  if (event.target.matches(".experience-media-input")) handleExperienceMediaAttachment(event);
});
experienceEventEditContent.addEventListener("click", (event) => {
  if (event.target.closest("[data-cancel-experience-location-edit]")) closeExperienceEventEdit();
  else if (event.target.closest("[data-find-event-location]")) findExperienceEventLocation();
  else handleExperienceLocationClick(event);
});
experienceEventEditContent.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("input[name=label]")) {
    event.preventDefault();
    findExperienceEventLocation();
  }
});
experienceEventEditContent.addEventListener("submit", saveExperienceLocation);
experienceEventEditContent.addEventListener("change", (event) => {
  if (event.target.matches(".experience-media-input")) handleExperienceMediaAttachment(event);
});
backFromExperienceEventEditBtn.addEventListener("click", closeExperienceEventEdit);
authForm.addEventListener("submit", handleAuthSubmit);
signOutBtn.addEventListener("click", () => {
  clearStoredSession();
  session = null;
  profile = null;
  trips = [];
  currentTrip = null;
  experiences = [];
  activeExperience = null;
  experienceLocations = [];
  experienceLayer.clearLayers();
  checkIns = [];
  renderCheckInList();
  renderCheckInMarkers();
  setAuthUi(false, { keepAppVisible: true });
  setLoggedOutPreview(true);
});
tripListEl.addEventListener("click", handleTripListAction);
tripListEl.addEventListener("change", handleTripListAction);
tripListEl.addEventListener("dragstart", handleTripDragStart);
tripListEl.addEventListener("dragover", handleTripDragOver);
tripListEl.addEventListener("drop", handleTripDrop);
tripListEl.addEventListener("dragend", clearTripDragState);
newTripBtn.addEventListener("click", openNewTripScreen);
backFromNewTripBtn.addEventListener("click", closeNewTripScreen);
cancelNewTripBtn.addEventListener("click", closeNewTripScreen);
newTripForm.addEventListener("submit", saveNewTrip);
backFromRenameBtn.addEventListener("click", closeRenameTripScreen);
cancelRenameBtn.addEventListener("click", closeRenameTripScreen);
renameTripForm.addEventListener("submit", saveRenamedTrip);
refreshAdminBtn.addEventListener("click", async () => {
  try { await loadAdminData(); setStatus(adminStatus, "Admin data refreshed.", "success"); } catch (error) { setStatus(adminStatus, error.message, "error"); }
});
adminContent.addEventListener("click", handleAdminAction);
clearCheckInsBtn.addEventListener("click", clearAllCheckIns);
map.on("contextmenu", handleMapContextMenu);
map.getContainer().addEventListener("click", handleMapPopupAction);
experienceMap.getContainer().addEventListener("click", handleMapPopupAction);
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
  setLoggedOutPreview(false);
  setAuthUi(false);
  renderCheckInList();
  renderCheckInMarkers();
  renderPhotoList();
  document.body.classList.remove("public-trip-view");
  document.body.classList.remove("public-experience-view");
  document.body.classList.add("home-page");
  if (isExperienceUrl) {
    document.body.classList.remove("home-page");
    const restoredSession = await restoreSession();
    if (restoredSession) {
      session = restoredSession;
      await loadProfile();
      appContent.hidden = false;
      setAuthUi(true);
      userStatus.textContent = profile.username || profile.display_name;
      updateAvatar(profile.avatar_url);
      adminPanel.hidden = profile.role !== "admin";
    }
    try {
      await loadExperiences({ scopeToUrl: true });
    } catch (error) {
      session = null;
      profile = null;
      document.body.classList.remove("public-experience-view");
      setAuthUi(false);
      appContent.hidden = true;
      authPanel.hidden = false;
      setStatus(authStatus, `Could not open this experience: ${error.message}`, "error");
      return;
    }
    try {
      activeExperience = experiences[0] || null;
      document.body.classList.add("public-experience-view");
      experienceViewMode = restoredSession && canEditExperience(activeExperience) ? "edit" : "view";
      showExperienceScreen("detail");
      experiencePanel.classList.add("experience-detail-open");
      renderExperiences();
      if (isPublicExperience && !restoredSession) {
        setAuthUi(false, { keepAppVisible: true });
        userStatus.textContent = `Experience: ${activeExperience.name}`;
        authPanel.hidden = false;
        authMode = "signin";
        authModeLabel.textContent = "Sign in";
        authSubmitBtn.textContent = "Sign in";
      }
      appContent.hidden = false;
      experiencePanel.hidden = false;
      experiencePanel.classList.remove("trip-panel-open");
      try {
        await loadExperienceLocations();
      } catch (error) {
        experienceLocationList.innerHTML = `<li class="form-error">Could not load events: ${escapeHtml(error.message)}</li>`;
      }
      window.setTimeout(() => {
        map.invalidateSize();
        fitExperienceMap();
        if (experienceLocations.length) map.fitBounds(L.latLngBounds(experienceLocations.map((location) => [location.lat, location.lon])), { padding: [40, 40], maxZoom: 12 });
      }, 0);
    } catch (error) {
      appContent.hidden = false;
      experiencePanel.hidden = false;
      experiencePanel.innerHTML = `<p class="form-error">Could not display this experience: ${escapeHtml(error.message)}</p>`;
    }
    return;
  }
  if (isPublicTrip) {
    document.body.classList.remove("home-page");
    authPanel.hidden = true;
    appContent.hidden = false;
    document.body.classList.add("public-trip-view");
    try {
      const restoredSession = await restoreSession();
      if (restoredSession) {
        session = restoredSession;
        setLoggedOutPreview(false);
        await loadProfile();
        setAuthUi(true);
        userStatus.textContent = profile.username || profile.display_name;
        updateAvatar(profile.avatar_url);
        adminPanel.hidden = profile.role !== "admin";
        document.body.classList.remove("public-trip-view");
        authPanel.hidden = true;
      } else {
        setAuthUi(false, { keepAppVisible: true });
        setLoggedOutPreview(true);
        return;
      }
      await loadTrips();
      await loadCheckIns();
      renderTripSelect();
      renderCheckInList();
      renderCheckInMarkers();
      renderPhotoList();
      if (!session) {
        userStatus.textContent = `Trip: ${currentTrip.name}`;
      }
      setStatus(checkInStatus, "Viewing a public trip.", "success");
      window.setTimeout(() => {
        map.invalidateSize();
        fitMapToCheckIns();
      }, 0);
    } catch (error) {
      clearStoredSession();
      session = null;
      profile = null;
      setAuthUi(false, { keepAppVisible: true });
      setLoggedOutPreview(true);
    }
    return;
  }
  showWelcome();
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
  setAuthUi(false, { keepAppVisible: true });
  setLoggedOutPreview(true);
}

initializeApp();
