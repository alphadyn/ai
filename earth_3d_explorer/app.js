import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const EARTH_RADIUS_KM = 6371;
const GLOBE_RADIUS = 2;
const MARKER_RADIUS = 0.035;
const MARKER_DIAMETER_PX = 7;

const container = document.getElementById("globeContainer");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const resetViewBtn = document.getElementById("resetViewBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const bordersLayer = document.getElementById("bordersLayer");
const gridLayer = document.getElementById("gridLayer");
const citiesLayer = document.getElementById("citiesLayer");
const mapLabels = document.getElementById("mapLabels");
const inspectModeBtn = document.getElementById("inspectModeBtn");
const measureModeBtn = document.getElementById("measureModeBtn");
const inspectPanel = document.getElementById("inspectPanel");
const measurePanel = document.getElementById("measurePanel");
const inspectEmpty = document.getElementById("inspectEmpty");
const inspectDetails = document.getElementById("inspectDetails");
const detailLat = document.getElementById("detailLat");
const detailLon = document.getElementById("detailLon");
const detailHemisphere = document.getElementById("detailHemisphere");
const detailCountry = document.getElementById("detailCountry");
const wikipediaLink = document.getElementById("wikipediaLink");
const pointAEl = document.getElementById("pointA");
const pointBEl = document.getElementById("pointB");
const distanceValueEl = document.getElementById("distanceValue");
const resetMeasureBtn = document.getElementById("resetMeasureBtn");

let mode = "inspect"; // "inspect" | "measure"
let measurePoints = []; // holds up to two { vector, lat, lon } entries
const measureMarkers = [];
let measureLine = null;
let inspectMarker = null;
let countryFeatures = []; // GeoJSON features used for both the border overlay and name lookup

// --- Scene setup ---------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.6;
controls.maxDistance = 10;

// OrbitControls rotates by an angle per screen pixel, independent of zoom.
// At the center of a perspective-projected globe, a surface point moves by
// R / (distance - R) pixels per radian (times the camera's focal length).
// Match that motion to the pointer so zooming in does not amplify a swipe.
function updateRotateSpeed() {
  const distance = camera.position.distanceTo(controls.target);
  controls.rotateSpeed =
    ((distance - GLOBE_RADIUS) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
    (Math.PI * GLOBE_RADIUS);
}

updateRotateSpeed();
controls.addEventListener("change", updateRotateSpeed);

function updateZoomButtons() {
  const distance = camera.position.distanceTo(controls.target);
  zoomInBtn.disabled = distance <= controls.minDistance + 0.001;
  zoomOutBtn.disabled = distance >= controls.maxDistance - 0.001;
}

function zoomBy(factor) {
  const offset = camera.position.clone().sub(controls.target);
  const distance = THREE.MathUtils.clamp(
    offset.length() * factor, controls.minDistance, controls.maxDistance
  );
  camera.position.copy(controls.target).add(offset.setLength(distance));
  controls.update();
  updateZoomButtons();
}

zoomInBtn.addEventListener("click", () => zoomBy(1 / 1.3));
zoomOutBtn.addEventListener("click", () => zoomBy(1.3));
resetViewBtn.addEventListener("click", () => {
  controls.reset();
  updateZoomButtons();
});
controls.addEventListener("change", updateZoomButtons);
updateZoomButtons();

fullscreenBtn.disabled = !container.requestFullscreen || !document.exitFullscreen;
fullscreenBtn.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement === container) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  } catch (error) {
    console.warn("Unable to toggle fullscreen:", error);
  }
});

document.addEventListener("fullscreenchange", () => {
  const isFullscreen = document.fullscreenElement === container;
  fullscreenBtn.setAttribute("aria-pressed", String(isFullscreen));
  fullscreenBtn.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
  fullscreenBtn.title = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
  resizeRendererToDisplaySize();
});

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.1);
sunLight.position.set(5, 3, 5);
scene.add(sunLight);

// Starfield backdrop
const starGeometry = new THREE.BufferGeometry();
const starCount = 1500;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const radius = 40 + Math.random() * 40;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
  starPositions[i * 3 + 2] = radius * Math.cos(phi);
}
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const starField = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, sizeAttenuation: true })
);
scene.add(starField);

// Earth sphere
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load(
  "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg"
);
const earthGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
const earthMaterial = new THREE.MeshPhongMaterial({
  map: earthTexture,
  shininess: 8,
});
const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earthMesh);

// Thin atmosphere glow shell
const atmosphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(GLOBE_RADIUS * 1.015, 64, 64),
  new THREE.MeshBasicMaterial({
    color: 0x4da3ff,
    transparent: true,
    opacity: 0.08,
    side: THREE.BackSide,
  })
);
scene.add(atmosphereMesh);

// Country boundary overlay, drawn just above the earth's surface
const COUNTRY_BORDERS_URL =
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";
const BORDER_RADIUS = GLOBE_RADIUS * 1.002;
let borderMesh = null;

bordersLayer.addEventListener("change", () => {
  if (borderMesh) borderMesh.visible = bordersLayer.checked;
});

// Reveal progressively finer coordinate lines as the camera approaches the globe.
const coordinateGrids = [];

function makeCoordinateGrid(step, opacity) {
  const positions = [];
  const radius = GLOBE_RADIUS * 1.006;
  function addSegment(lat1, lon1, lat2, lon2) {
    const a = latLonToVector3(lat1, lon1, radius);
    const b = latLonToVector3(lat2, lon2, radius);
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  for (let lat = -90 + step; lat < 90; lat += step) {
    if (step < 30 && lat % (step === 5 ? 15 : 30) === 0) continue;
    for (let lon = -180; lon < 180; lon += 2) {
      addSegment(lat, lon, lat, lon + 2);
    }
  }
  for (let lon = -180; lon < 180; lon += step) {
    if (step < 30 && lon % (step === 5 ? 15 : 30) === 0) continue;
    for (let lat = -90; lat < 90; lat += 2) {
      addSegment(lat, lon, lat + 2, lon);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const grid = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xa7cdeb, transparent: true, opacity })
  );
  scene.add(grid);
  return grid;
}

coordinateGrids.push(
  { maxDistance: Infinity, mesh: makeCoordinateGrid(30, 0.22) },
  { maxDistance: 4.8, mesh: makeCoordinateGrid(15, 0.16) },
  { maxDistance: 3.5, mesh: makeCoordinateGrid(5, 0.12) }
);

function updateCoordinateGrids() {
  const distance = camera.position.distanceTo(controls.target);
  for (const { maxDistance, mesh } of coordinateGrids) {
    mesh.visible = gridLayer.checked && distance <= maxDistance;
  }
}

gridLayer.addEventListener("change", updateCoordinateGrids);
controls.addEventListener("change", updateCoordinateGrids);
updateCoordinateGrids();

function addRingSegments(ring, positions) {
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    const p1 = latLonToVector3(lat1, lon1, BORDER_RADIUS);
    const p2 = latLonToVector3(lat2, lon2, BORDER_RADIUS);
    positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  }
}

async function loadCountryBorders() {
  const response = await fetch(COUNTRY_BORDERS_URL);
  if (!response.ok) throw new Error(`Failed to fetch country borders: ${response.status}`);
  const geojson = await response.json();
  countryFeatures = geojson.features;

  const positions = [];
  for (const feature of geojson.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === "Polygon") {
      geometry.coordinates.forEach((ring) => addRingSegments(ring, positions));
    } else if (geometry.type === "MultiPolygon") {
      geometry.coordinates.forEach((polygon) =>
        polygon.forEach((ring) => addRingSegments(ring, positions))
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x7fd8ff,
    transparent: true,
    opacity: 0.55,
  });
  borderMesh = new THREE.LineSegments(geometry, material);
  borderMesh.visible = bordersLayer.checked;
  scene.add(borderMesh);
}

loadCountryBorders().catch((error) => {
  console.warn("Country borders could not be loaded:", error);
});

// --- Country lookup (point-in-polygon over the loaded GeoJSON) ------------
/** Even-odd ray-casting test for whether [lon, lat] is inside a GeoJSON linear ring. */
function isPointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > lat !== yj > lat;
    if (crosses && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** A GeoJSON Polygon's coordinates are [outerRing, ...holeRings]. */
function isPointInPolygonRings(lon, lat, rings) {
  if (!isPointInRing(lon, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (isPointInRing(lon, lat, rings[i])) return false; // inside a hole
  }
  return true;
}

/** Find the name of the country whose polygon contains the given lat/lon, if any. */
function findCountryName(lat, lon) {
  for (const feature of countryFeatures) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === "Polygon") {
      if (isPointInPolygonRings(lon, lat, geometry.coordinates)) {
        return feature.properties?.name ?? null;
      }
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) {
        if (isPointInPolygonRings(lon, lat, polygon)) {
          return feature.properties?.name ?? null;
        }
      }
    }
  }
  return null;
}

// ISO 3166-1 alpha-2 codes for the country names used in the GeoJSON border dataset,
// used to render a flag emoji next to the inspected country's name.
const COUNTRY_ISO_CODES = {
  Afghanistan: "AF", Albania: "AL", Algeria: "DZ", Angola: "AO", Antarctica: "AQ",
  Argentina: "AR", Armenia: "AM", Australia: "AU", Austria: "AT", Azerbaijan: "AZ",
  Bangladesh: "BD", Belarus: "BY", Belgium: "BE", Belize: "BZ", Benin: "BJ",
  Bermuda: "BM", Bhutan: "BT", Bolivia: "BO", "Bosnia and Herzegovina": "BA",
  Botswana: "BW", Brazil: "BR", Brunei: "BN", Bulgaria: "BG", "Burkina Faso": "BF",
  Burundi: "BI", Cambodia: "KH", Cameroon: "CM", Canada: "CA",
  "Central African Republic": "CF", Chad: "TD", Chile: "CL", China: "CN",
  Colombia: "CO", "Costa Rica": "CR", Croatia: "HR", Cuba: "CU", Cyprus: "CY",
  "Czech Republic": "CZ", "Democratic Republic of the Congo": "CD", Denmark: "DK",
  Djibouti: "DJ", "Dominican Republic": "DO", "East Timor": "TL", Ecuador: "EC",
  Egypt: "EG", "El Salvador": "SV", "Equatorial Guinea": "GQ", Eritrea: "ER",
  Estonia: "EE", Ethiopia: "ET", "Falkland Islands": "FK", Fiji: "FJ",
  Finland: "FI", France: "FR", "French Guiana": "GF",
  "French Southern and Antarctic Lands": "TF", Gabon: "GA", Gambia: "GM",
  Georgia: "GE", Germany: "DE", Ghana: "GH", Greece: "GR", Greenland: "GL",
  Guatemala: "GT", Guinea: "GN", "Guinea Bissau": "GW", Guyana: "GY", Haiti: "HT",
  Honduras: "HN", Hungary: "HU", Iceland: "IS", India: "IN", Indonesia: "ID",
  Iran: "IR", Iraq: "IQ", Ireland: "IE", Israel: "IL", Italy: "IT",
  "Ivory Coast": "CI", Jamaica: "JM", Japan: "JP", Jordan: "JO", Kazakhstan: "KZ",
  Kenya: "KE", Kosovo: "XK", Kuwait: "KW", Kyrgyzstan: "KG", Laos: "LA",
  Latvia: "LV", Lebanon: "LB", Lesotho: "LS", Liberia: "LR", Libya: "LY",
  Lithuania: "LT", Luxembourg: "LU", Macedonia: "MK", Madagascar: "MG",
  Malawi: "MW", Malaysia: "MY", Mali: "ML", Malta: "MT", Mauritania: "MR",
  Mexico: "MX", Moldova: "MD", Mongolia: "MN", Montenegro: "ME", Morocco: "MA",
  Mozambique: "MZ", Myanmar: "MM", Namibia: "NA", Nepal: "NP", Netherlands: "NL",
  "New Caledonia": "NC", "New Zealand": "NZ", Nicaragua: "NI", Niger: "NE",
  Nigeria: "NG", "North Korea": "KP", "Northern Cyprus": "CY", Norway: "NO",
  Oman: "OM", Pakistan: "PK", Panama: "PA", "Papua New Guinea": "PG",
  Paraguay: "PY", Peru: "PE", Philippines: "PH", Poland: "PL", Portugal: "PT",
  "Puerto Rico": "PR", Qatar: "QA", "Republic of Serbia": "RS",
  "Republic of the Congo": "CG", Romania: "RO", Russia: "RU", Rwanda: "RW",
  "Saudi Arabia": "SA", Senegal: "SN", "Sierra Leone": "SL", Slovakia: "SK",
  Slovenia: "SI", "Solomon Islands": "SB", Somalia: "SO", Somaliland: "SO",
  "South Africa": "ZA", "South Korea": "KR", "South Sudan": "SS", Spain: "ES",
  "Sri Lanka": "LK", Sudan: "SD", Suriname: "SR", Swaziland: "SZ", Sweden: "SE",
  Switzerland: "CH", Syria: "SY", Taiwan: "TW", Tajikistan: "TJ", Thailand: "TH",
  "The Bahamas": "BS", Togo: "TG", "Trinidad and Tobago": "TT", Tunisia: "TN",
  Turkey: "TR", Turkmenistan: "TM", Uganda: "UG", Ukraine: "UA",
  "United Arab Emirates": "AE", "United Kingdom": "GB",
  "United Republic of Tanzania": "TZ", "United States of America": "US",
  Uruguay: "UY", Uzbekistan: "UZ", Vanuatu: "VU", Venezuela: "VE", Vietnam: "VN",
  "West Bank": "PS", "Western Sahara": "EH", Yemen: "YE", Zambia: "ZM",
  Zimbabwe: "ZW",
};

/** Convert an ISO 3166-1 alpha-2 code into its flag emoji (regional indicator symbols). */
function countryCodeToFlagEmoji(isoCode) {
  if (!isoCode || isoCode.length !== 2) return "";
  const codePoints = [...isoCode.toUpperCase()].map((char) => 0x1f1e6 - 65 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function resizeRendererToDisplaySize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

resizeRendererToDisplaySize();
window.addEventListener("resize", resizeRendererToDisplaySize);
new ResizeObserver(resizeRendererToDisplaySize).observe(container);

const cameraForward = new THREE.Vector3();
const markerOffset = new THREE.Vector3();

function updateMarkerSizes() {
  camera.getWorldDirection(cameraForward);
  const pixelsToWorld = (MARKER_DIAMETER_PX * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
    (MARKER_RADIUS * renderer.domElement.clientHeight);
  function scaleMarker(marker) {
    const depth = markerOffset.subVectors(marker.position, camera.position).dot(cameraForward);
    marker.scale.setScalar(depth * pixelsToWorld);
  }
  if (inspectMarker) scaleMarker(inspectMarker);
  for (const marker of measureMarkers) scaleMarker(marker);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateMarkerSizes();
  updateCityLabels();
  renderer.render(scene, camera);
}

// --- Coordinate helpers ---------------------------------------------------
// These match the UV unwrap of THREE.SphereGeometry for a standard equirectangular
// texture (prime meridian at the texture's horizontal center), so surface clicks,
// the earth texture, and the country border overlay all agree on the same lat/lon.

/** Convert a point on the sphere surface to { lat, lon } in degrees. */
function pointToLatLon(point) {
  const normalized = point.clone().normalize();
  const lat = (Math.asin(THREE.MathUtils.clamp(normalized.y, -1, 1)) * 180) / Math.PI;
  const lon = (Math.atan2(-normalized.z, normalized.x) * 180) / Math.PI;
  return { lat, lon };
}

/** Convert latitude/longitude in degrees to a point on the sphere surface (inverse of pointToLatLon). */
function latLonToVector3(lat, lon, radius) {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(latRad) * Math.cos(lonRad),
    radius * Math.sin(latRad),
    -radius * Math.cos(latRad) * Math.sin(lonRad)
  );
}

const CITY_TIERS = [
  // Major hubs remain visible from the default view.
  { maxDistance: Infinity, nameDistance: 5.2, cities: [
  ["Los Angeles", 34.05, -118.24], ["New York", 40.71, -74.01],
  ["Mexico City", 19.43, -99.13], ["São Paulo", -23.55, -46.63],
  ["Buenos Aires", -34.60, -58.38], ["London", 51.51, -0.13],
  ["Paris", 48.86, 2.35], ["Cairo", 30.04, 31.24],
  ["Lagos", 6.52, 3.38], ["Johannesburg", -26.20, 28.05],
  ["Dubai", 25.20, 55.27], ["Mumbai", 19.08, 72.88],
  ["Singapore", 1.35, 103.82], ["Beijing", 39.90, 116.40],
  ["Tokyo", 35.68, 139.69], ["Sydney", -33.87, 151.21],
  ] },
  // Regional cities emerge alongside the 15° coordinate grid.
  { maxDistance: 4.8, nameDistance: 4.8, cities: [
    ["Vancouver", 49.28, -123.12], ["Seattle", 47.61, -122.33],
    ["San Francisco", 37.77, -122.42], ["Chicago", 41.88, -87.63],
    ["Toronto", 43.65, -79.38], ["Miami", 25.76, -80.19],
    ["Bogotá", 4.71, -74.07], ["Lima", -12.05, -77.04],
    ["Santiago", -33.45, -70.67], ["Rio de Janeiro", -22.91, -43.17],
    ["Lisbon", 38.72, -9.14], ["Madrid", 40.42, -3.70],
    ["Rome", 41.90, 12.50], ["Berlin", 52.52, 13.41],
    ["Istanbul", 41.01, 28.98], ["Moscow", 55.76, 37.62],
    ["Nairobi", -1.29, 36.82], ["Addis Ababa", 9.03, 38.75],
    ["Cape Town", -33.92, 18.42], ["Casablanca", 33.57, -7.59],
    ["Riyadh", 24.71, 46.67], ["Karachi", 24.86, 67.01],
    ["Delhi", 28.61, 77.21], ["Bangkok", 13.76, 100.50],
    ["Hanoi", 21.03, 105.85], ["Jakarta", -6.21, 106.85],
    ["Hong Kong", 22.32, 114.17], ["Shanghai", 31.23, 121.47],
    ["Seoul", 37.57, 126.98], ["Osaka", 34.69, 135.50],
    ["Melbourne", -37.81, 144.96], ["Auckland", -36.85, 174.76],
  ] },
  // Nearby cities become useful only at the closest zoom levels.
  { maxDistance: 3.5, nameDistance: 3.5, cities: [
    ["Portland", 45.52, -122.68], ["Las Vegas", 36.17, -115.14],
    ["San Diego", 32.72, -117.16], ["Phoenix", 33.45, -112.07],
    ["Dallas", 32.78, -96.80], ["Houston", 29.76, -95.37],
    ["Boston", 42.36, -71.06], ["Washington, DC", 38.91, -77.04],
    ["Montréal", 45.50, -73.57], ["Medellín", 6.24, -75.58],
    ["Brasília", -15.79, -47.88], ["Porto Alegre", -30.03, -51.23],
    ["Manchester", 53.48, -2.24], ["Amsterdam", 52.37, 4.90],
    ["Brussels", 50.85, 4.35], ["Munich", 48.14, 11.58],
    ["Milan", 45.46, 9.19], ["Athens", 37.98, 23.73],
    ["Alexandria", 31.20, 29.92], ["Accra", 5.60, -0.19],
    ["Abu Dhabi", 24.45, 54.38], ["Bengaluru", 12.97, 77.59],
    ["Chennai", 13.08, 80.27], ["Kolkata", 22.57, 88.36],
    ["Ho Chi Minh City", 10.82, 106.63], ["Kuala Lumpur", 3.14, 101.69],
    ["Taipei", 25.03, 121.56], ["Guangzhou", 23.13, 113.26],
    ["Kyoto", 35.01, 135.77], ["Canberra", -35.28, 149.13],
  ] },
];

const cityLabels = CITY_TIERS.flatMap(({ maxDistance, nameDistance, cities }) => cities.map(([name, lat, lon]) => {
  const element = document.createElement("span");
  element.className = "city-label";
  const nameElement = document.createElement("span");
  nameElement.className = "city-name";
  nameElement.textContent = name;
  element.appendChild(nameElement);
  mapLabels.appendChild(element);
  return { position: latLonToVector3(lat, lon, GLOBE_RADIUS * 1.012), element,
    maxDistance, nameDistance, nameWidth: name.length * 6.5 + 14 };
}));

const projectedCity = new THREE.Vector3();

function updateCityLabels() {
  mapLabels.hidden = !citiesLayer.checked;
  if (!citiesLayer.checked) return;
  const width = renderer.domElement.clientWidth;
  const height = renderer.domElement.clientHeight;
  const distance = camera.position.distanceTo(controls.target);
  // Reserve the corners for fullscreen and zoom buttons, then prioritize
  // major city names when labels are close together.
  const occupied = [
    { left: 0, right: 56, top: 0, bottom: 136 },
    { left: width - 56, right: width, top: 0, bottom: 52 },
  ];
  for (const { position, element, maxDistance, nameDistance, nameWidth } of cityLabels) {
    if (distance > maxDistance) {
      element.hidden = true;
      continue;
    }
    // Hide points behind the sphere, including those close to its horizon.
    if (position.dot(camera.position) <= position.lengthSq()) {
      element.hidden = true;
      continue;
    }
    projectedCity.copy(position).project(camera);
    element.hidden = Math.abs(projectedCity.x) > 1 || Math.abs(projectedCity.y) > 1;
    if (element.hidden) continue;
    const x = (projectedCity.x + 1) * width / 2;
    const y = (1 - projectedCity.y) * height / 2;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    const label = { left: x - 3, right: x + nameWidth, top: y - 9, bottom: y + 9 };
    const showName = distance < nameDistance && label.left >= 0 && label.right < width &&
      label.top >= 0 && label.bottom < height &&
      !occupied.some((other) => label.left < other.right && label.right > other.left &&
        label.top < other.bottom && label.bottom > other.top);
    element.classList.toggle("show-name", showName);
    if (showName) occupied.push(label);
  }
}

citiesLayer.addEventListener("change", updateCityLabels);
animate();

function formatCoordinate(lat, lon) {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}\u00B0${latDir}, ${Math.abs(lon).toFixed(2)}\u00B0${lonDir}`;
}

function hemisphereLabel(lat, lon) {
  const ns = lat >= 0 ? "Northern" : "Southern";
  const ew = lon >= 0 ? "Eastern" : "Western";
  return `${ns} / ${ew}`;
}

/** Great-circle distance in km between two points on the sphere surface. */
function surfaceDistanceKm(pointA, pointB) {
  const angle = pointA.clone().normalize().angleTo(pointB.clone().normalize());
  return angle * EARTH_RADIUS_KM;
}

function makeMarker(color) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(MARKER_RADIUS, 16, 16),
    new THREE.MeshBasicMaterial({ color })
  );
  scene.add(marker);
  return marker;
}

/** Build a great-circle arc line between two surface points, raised slightly above the globe. */
function buildArcLine(pointA, pointB) {
  const raised = 1.01;
  const start = pointA.clone().normalize().multiplyScalar(GLOBE_RADIUS * raised);
  const end = pointB.clone().normalize().multiplyScalar(GLOBE_RADIUS * raised);
  const angle = start.angleTo(end);
  const segments = 64;
  const positions = [];
  const sinAngle = Math.sin(angle);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const slerped = new THREE.Vector3();
    if (angle > 0.0001) {
      // Spherical interpolation so the line follows the great-circle path
      const a = Math.sin((1 - t) * angle) / sinAngle;
      const b = Math.sin(t * angle) / sinAngle;
      slerped.copy(start).multiplyScalar(a).add(end.clone().multiplyScalar(b));
    } else {
      slerped.copy(start);
    }
    positions.push(slerped.x, slerped.y, slerped.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xffd166, linewidth: 2 });
  return new THREE.Line(geometry, material);
}

// --- Interaction ------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let pointerDownPos = null;
let pendingSelection = null;

function onPointerDown(event) {
  if (event.button !== 0) return;
  pointerDownPos = { x: event.clientX, y: event.clientY, id: event.pointerId };
}

function onPointerUp(event) {
  if (!pointerDownPos || event.pointerId !== pointerDownPos.id) return;
  const dx = event.clientX - pointerDownPos.x;
  const dy = event.clientY - pointerDownPos.y;
  pointerDownPos = null;
  // Ignore clicks that were actually drags used to rotate the globe
  if (Math.hypot(dx, dy) > 4) return;

  // Wait for the browser's dblclick event before selecting a point, so a
  // double-click zoom doesn't also drop an inspect/measurement marker.
  const { clientX, clientY } = event;
  clearTimeout(pendingSelection);
  pendingSelection = setTimeout(() => {
    pendingSelection = null;
    selectPoint(clientX, clientY);
  }, 300);
}

function selectPoint(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObject(earthMesh);
  if (hits.length === 0) return;

  const point = hits[0].point;
  if (mode === "inspect") {
    handleInspectClick(point);
  } else {
    handleMeasureClick(point);
  }
}

renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("pointerup", onPointerUp);
renderer.domElement.addEventListener("pointercancel", () => { pointerDownPos = null; });
renderer.domElement.addEventListener("dblclick", (event) => {
  event.preventDefault();
  clearTimeout(pendingSelection);
  pendingSelection = null;
  zoomBy(1 / 1.3);
});

function handleInspectClick(point) {
  const { lat, lon } = pointToLatLon(point);

  if (!inspectMarker) {
    inspectMarker = makeMarker(0x4da3ff);
  }
  inspectMarker.position.copy(point.clone().normalize().multiplyScalar(GLOBE_RADIUS * 1.01));
  inspectMarker.visible = true;

  inspectEmpty.classList.add("hidden");
  inspectDetails.classList.remove("hidden");
  detailLat.textContent = `${lat.toFixed(3)}\u00B0`;
  detailLon.textContent = `${lon.toFixed(3)}\u00B0`;
  detailHemisphere.textContent = hemisphereLabel(lat, lon);

  const countryName = findCountryName(lat, lon);
  if (countryName) {
    const flag = countryCodeToFlagEmoji(COUNTRY_ISO_CODES[countryName]);
    detailCountry.textContent = flag ? `${flag} ${countryName}` : countryName;
    const title = encodeURIComponent(countryName.replace(/ /g, "_"));
    wikipediaLink.href = `https://en.wikipedia.org/wiki/${title}`;
    wikipediaLink.textContent = `View "${countryName}" on Wikipedia \u2197`;
    wikipediaLink.classList.remove("hidden");
  } else {
    detailCountry.textContent = "Ocean / unclaimed";
    wikipediaLink.classList.add("hidden");
  }
}

function handleMeasureClick(point) {
  if (measurePoints.length >= 2) {
    clearMeasurement();
  }

  const { lat, lon } = pointToLatLon(point);
  const marker = makeMarker(measurePoints.length === 0 ? 0x06d6a0 : 0xffd166);
  marker.position.copy(point.clone().normalize().multiplyScalar(GLOBE_RADIUS * 1.01));
  measureMarkers.push(marker);
  measurePoints.push({ vector: point.clone(), lat, lon });

  if (measurePoints.length === 1) {
    pointAEl.textContent = formatCoordinate(lat, lon);
    pointBEl.textContent = "\u2014";
    distanceValueEl.textContent = "\u2014";
  } else {
    pointBEl.textContent = formatCoordinate(lat, lon);
    const km = surfaceDistanceKm(measurePoints[0].vector, measurePoints[1].vector);
    const miles = km * 0.621371;
    distanceValueEl.textContent = `${km.toFixed(1)} km (${miles.toFixed(1)} mi)`;

    if (measureLine) scene.remove(measureLine);
    measureLine = buildArcLine(measurePoints[0].vector, measurePoints[1].vector);
    scene.add(measureLine);
  }
}

function clearMeasurement() {
  measurePoints = [];
  measureMarkers.forEach((marker) => scene.remove(marker));
  measureMarkers.length = 0;
  if (measureLine) {
    scene.remove(measureLine);
    measureLine = null;
  }
  pointAEl.textContent = "\u2014";
  pointBEl.textContent = "\u2014";
  distanceValueEl.textContent = "\u2014";
}

resetMeasureBtn.addEventListener("click", clearMeasurement);

function setMode(nextMode) {
  mode = nextMode;
  const isInspect = mode === "inspect";
  inspectModeBtn.classList.toggle("active", isInspect);
  measureModeBtn.classList.toggle("active", !isInspect);
  inspectPanel.classList.toggle("hidden", !isInspect);
  measurePanel.classList.toggle("hidden", isInspect);
}

inspectModeBtn.addEventListener("click", () => setMode("inspect"));
measureModeBtn.addEventListener("click", () => setMode("measure"));
