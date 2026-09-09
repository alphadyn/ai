const lockScreen = document.querySelector('#lockScreen');
const homeScreen = document.querySelector('#homeScreen');
const controlCenter = document.querySelector('#controlCenter');
const appWindow = document.querySelector('#appWindow');
const appContent = document.querySelector('#appContent');
const dynamicIsland = document.querySelector('#dynamicIsland');
const toast = document.querySelector('#toast');
const statusTime = document.querySelector('#statusTime');
const lockTime = document.querySelector('#lockTime');
const homeIndicator = document.querySelector('#homeIndicator');
let isUnlocked = false;
let toastTimer;
const safariState = { history: ['apple.com'], index: 0 };
const weatherState = { location: 'Bellevue, WA', temperature: 72, condition: 'Sunny', high: 78, low: 57 };

const appViews = {
  messages: `<div class="app-header"><h2>Messages</h2><button class="app-back" data-close-app>Done</button></div><div class="app-body"><div class="app-hero"><h3>Good morning.</h3><p>Your conversations, right where you left them.</p></div><div class="list-item"><span class="list-dot">A</span><div><strong>Alex Morgan</strong><small>See you at 7? I found a great new place.</small></div></div><div class="list-item"><span class="list-dot" style="background:#9b7dea">J</span><div><strong>Jordan Lee</strong><small>Shared a location with you</small></div></div><div class="list-item"><span class="list-dot" style="background:#f18b56">M</span><div><strong>Mom</strong><small>Photo · Yesterday</small></div></div></div>`,
  camera: `<div class="camera-view"><div class="camera-top"><button data-close-app>×</button><span>Portrait</span><button>⌁</button></div><div class="camera-focus"></div><div class="camera-bottom"><button>◫</button><button class="shutter"></button><button>↻</button></div></div>`,
  photos: `<div class="app-header"><h2>Photos</h2><button class="app-back" data-close-app>Done</button></div><div class="app-body"><p style="color:#777;font-size:12px;margin-top:0">Recents · 248 items</p><div class="photo-grid"><i class="photo-tile"></i><i class="photo-tile"></i><i class="photo-tile"></i><i class="photo-tile"></i><i class="photo-tile"></i><i class="photo-tile"></i><i class="photo-tile"></i><i class="photo-tile"></i><i class="photo-tile"></i></div></div>`,
  music: `<div class="app-header"><h2>Music</h2><button class="app-back" data-close-app>Done</button></div><div class="app-body"><div class="app-hero" style="background:linear-gradient(135deg,#eb3c5c,#8b45c5)"><h3>Made for you</h3><p>Your personal mix is ready to play.</p></div><div class="list-item"><span class="list-dot" style="background:#222">♫</span><div><strong>Midnight Aperture</strong><small>Nova · New release</small></div><span style="margin-left:auto;color:#f34d66">▶</span></div><div class="list-item"><span class="list-dot" style="background:#eca942">♫</span><div><strong>Sunday in June</strong><small>Chapters</small></div><span style="margin-left:auto;color:#f34d66">▶</span></div></div>`,
  safari: `<div class="app-header safari-header"><h2>Safari</h2><button class="app-back" data-close-app>Done</button></div><form class="safari-bar" data-safari-form><button class="safari-nav" data-safari="back" type="button" aria-label="Back">‹</button><button class="safari-nav" data-safari="forward" type="button" aria-label="Forward">›</button><input value="apple.com" aria-label="Address" autocomplete="off" /><button class="safari-go" type="submit">Go</button></form><div class="safari-page" data-safari-page></div><div class="safari-toolbar"><button data-safari="back" type="button" aria-label="Back">‹</button><button data-safari="forward" type="button" aria-label="Forward">›</button><button data-safari="reload" type="button" aria-label="Reload">↻</button><button data-safari="share" type="button" aria-label="Share">↑</button><button data-safari="tabs" type="button" aria-label="Tabs">▢</button></div>`,
  settings: `<div class="app-header"><h2>Settings</h2><button class="app-back" data-close-app>Done</button></div><div class="app-body"><div class="settings-row"><span>Airplane Mode</span><button class="toggle" data-setting-toggle><i></i></button></div><div class="settings-row"><span>Wi-Fi</span><strong style="font-size:11px;color:#888">Home Network ›</strong></div><div class="settings-row"><span>Bluetooth</span><strong style="font-size:11px;color:#888">On ›</strong></div><div class="settings-row"><span>Display & Brightness</span><strong style="font-size:11px;color:#888">›</strong></div><div class="settings-row"><span>Camera</span><strong style="font-size:11px;color:#888">›</strong></div></div>`,
  notes: `<div class="app-header"><h2>Notes</h2><button class="app-back" data-close-app>Done</button></div><div class="app-body"><div style="padding:15px 0"><h3 style="margin:0 0 5px">Ideas for today</h3><p style="font-size:12px;line-height:1.7;color:#666">Make room for the things that make the day feel like yours.\n\n☑ Walk by the water\n☑ Call Alex\n□ Try something new</p></div></div>`,
  calendar: `<div class="app-header"><h2>Calendar</h2><button class="app-back" data-close-app>Done</button></div><div class="app-body"><div class="calendar-month"><button type="button" aria-label="Previous month">‹</button><strong id="calendarMonth">September 2026</strong><button type="button" aria-label="Next month">›</button></div><div class="calendar-week"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div><div class="calendar-grid" id="calendarGrid"></div><div class="calendar-event"><span class="event-dot"></span><div><strong>Today</strong><small>Make space for something new</small></div></div></div>`,
  weather: `<div class="app-header"><h2>Weather</h2><button class="app-back" data-close-app>Done</button></div><div class="app-body"><div class="weather-hero"><span class="weather-hero-sun">☼</span><strong id="weatherTemperature">72°</strong><p id="weatherCondition">Sunny</p><small id="weatherLocation">San Francisco</small><div><span>H: <b id="weatherHigh">78°</b></span><span>L: <b id="weatherLow">57°</b></span></div></div><div class="forecast-row"><div><small>NOW</small><span>☼</span><strong>72°</strong></div><div><small>2 PM</small><span>☼</span><strong>74°</strong></div><div><small>4 PM</small><span>◒</span><strong>76°</strong></div><div><small>6 PM</small><span>☾</span><strong>70°</strong></div></div></div>`,
  wallet: `<div class="app-header"><h2>Wallet</h2><button class="app-back" data-close-app>Done</button></div><div class="app-body"><div class="app-hero" style="background:linear-gradient(135deg,#24252b,#5d5f67)"><p>VISA</p><h3>•••• 4820</h3><p>Alphadyn</p></div><p style="font-size:11px;color:#777">Double-click the side button to pay.</p></div>`,
  phone: `<div class="app-header"><h2>Phone</h2><button class="app-back" data-close-app>Done</button></div><div class="app-body"><div class="app-hero" style="background:linear-gradient(135deg,#20c767,#0c9c91)"><h3>Favorites</h3><p>Reach the people you love, faster.</p></div><div class="list-item"><span class="list-dot">A</span><div><strong>Alex Morgan</strong><small>Mobile</small></div><span style="margin-left:auto;color:#25c763">☎</span></div><div class="list-item"><span class="list-dot" style="background:#f18b56">M</span><div><strong>Mom</strong><small>Mobile</small></div><span style="margin-left:auto;color:#25c763">☎</span></div></div>`,
  mail: `<div class="app-header"><h2>Mail</h2><button class="app-back" data-close-app>Done</button></div><div class="app-body"><p style="font-size:12px;color:#777">Inbox · 3 unread</p><div class="list-item"><span class="list-dot" style="background:#288ff3">⌁</span><div><strong>Apple</strong><small>Your order has shipped</small></div></div><div class="list-item"><span class="list-dot" style="background:#7d77e9">N</span><div><strong>Newsletter</strong><small>The best of September</small></div></div></div>`,
  calculator: `<div class="app-header"><h2>Calculator</h2><button class="app-back" data-close-app>Done</button></div><div class="app-body" style="padding-top:80px;text-align:right"><strong style="font-size:48px;letter-spacing:-.08em">0</strong><div class="cc-grid" style="margin-top:30px"><button class="cc-tile" style="color:#111;background:#ddd">AC</button><button class="cc-tile" style="color:#111;background:#ddd">＋/−</button><button class="cc-tile" style="color:#111;background:#ddd">%</button><button class="cc-tile" style="background:#ff9f0a">÷</button></div></div>`
};

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day = now.toLocaleDateString([], { weekday: 'short' }).toUpperCase();
  const date = now.getDate().toString().padStart(2, '0');
  const month = now.toLocaleDateString([], { month: 'short' }).toUpperCase();
  statusTime.textContent = time;
  lockTime.textContent = time;
  document.querySelector('#homeDay').textContent = day;
  document.querySelector('#homeDate').textContent = date;
  document.querySelector('#homeMonth').textContent = month;
  document.querySelector('.lock-topline span:last-child').textContent = now.toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric' });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function unlock() {
  isUnlocked = true;
  lockScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  document.querySelector('.wallpaper-lock').style.opacity = '0';
  document.querySelector('.wallpaper-home').style.opacity = '1';
}

function goHome() {
  controlCenter.classList.add('hidden');
  appWindow.classList.add('hidden');
  homeScreen.classList.remove('hidden');
}

function openApp(name) {
  if (!isUnlocked) return;
  appContent.innerHTML = appViews[name] || appViews.messages;
  appWindow.classList.remove('hidden');
  homeScreen.classList.add('hidden');
  if (name === 'safari') renderSafari();
  if (name === 'calendar') renderCalendar();
  if (name === 'weather') renderWeather();
}

function renderCalendar() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const grid = appContent.querySelector('#calendarGrid');
  appContent.querySelector('#calendarMonth').textContent = now.toLocaleDateString([], { month: 'long', year: 'numeric' });
  grid.innerHTML = `${'<span></span>'.repeat((firstDay + 6) % 7)}${Array.from({ length: daysInMonth }, (_, index) => `<span class="${index + 1 === now.getDate() ? 'today' : ''}">${index + 1}</span>`).join('')}`;
}

function renderWeather() {
  const temperature = `${weatherState.temperature}°`;
  document.querySelector('#homeTemperature').textContent = temperature;
  document.querySelector('#homeLocation').textContent = weatherState.location;
  appContent.querySelector('#weatherTemperature').textContent = temperature;
  appContent.querySelector('#weatherCondition').textContent = weatherState.condition;
  appContent.querySelector('#weatherLocation').textContent = weatherState.location;
  appContent.querySelector('#weatherHigh').textContent = `${weatherState.high}°`;
  appContent.querySelector('#weatherLow').textContent = `${weatherState.low}°`;
}

function normalizeSafariAddress(value) {
  const address = value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return address || 'apple.com';
}

function safariPage(address) {
  if (address === 'iphone17.apple.com' || address === 'apple.com/iphone-17-pro') {
    return `<p class="safari-brand">APPLE</p><h3>iPhone 17 Pro.<br>Designed to<br>be different.</h3><p>A19 Pro power. A titanium finish. The most capable iPhone yet, made for the moments that matter.</p><button class="safari-link" data-safari-link="apple.com" type="button">‹ Back to Apple</button>`;
  }
  if (address === 'apple.com') {
    return `<p class="safari-brand">APPLE</p><h3>Designed to<br>be different.</h3><p>The new iPhone 17 Pro brings a new level of performance to your everyday.</p><button class="safari-link" data-safari-link="iphone17.apple.com" type="button">Explore iPhone 17 Pro ›</button><div class="safari-card"><strong>Privacy. That's iPhone.</strong><small>Your data belongs to you.</small></div>`;
  }
  return `<p class="safari-brand">SEARCH</p><h3>Results for<br>“${address.replace(/[&<>"']/g, '')}”</h3><div class="safari-result"><strong>iPhone 17 Pro</strong><small>apple.com · A new generation of Pro performance.</small></div><div class="safari-result"><strong>Today in technology</strong><small>Explore the latest ideas, products, and stories.</small></div><button class="safari-link" data-safari-link="apple.com" type="button">Go to Apple ›</button>`;
}

function renderSafari() {
  const address = safariState.history[safariState.index];
  const addressInput = appContent.querySelector('[aria-label="Address"]');
  const page = appContent.querySelector('[data-safari-page]');
  if (!addressInput || !page) return;
  addressInput.value = address;
  page.innerHTML = safariPage(address);
  appContent.querySelector('[data-safari="back"]').disabled = safariState.index === 0;
  appContent.querySelector('[data-safari="forward"]').disabled = safariState.index === safariState.history.length - 1;
}

function navigateSafari(value) {
  const address = normalizeSafariAddress(value);
  safariState.history = safariState.history.slice(0, safariState.index + 1);
  safariState.history.push(address);
  safariState.index += 1;
  renderSafari();
}

function moveSafariHistory(step) {
  const nextIndex = safariState.index + step;
  if (nextIndex < 0 || nextIndex >= safariState.history.length) return;
  safariState.index = nextIndex;
  renderSafari();
}

function openControlCenter() {
  if (!isUnlocked) return;
  appWindow.classList.add('hidden');
  controlCenter.classList.remove('hidden');
}

updateClock();
setInterval(updateClock, 30000);

document.querySelector('#unlockPrompt').addEventListener('click', unlock);
document.querySelector('#lockScreen').addEventListener('dblclick', unlock);
homeIndicator.addEventListener('click', goHome);
dynamicIsland.addEventListener('click', () => dynamicIsland.classList.toggle('expanded'));
document.querySelector('#statusBar').addEventListener('click', openControlCenter);
document.querySelector('#closeControlCenter').addEventListener('click', goHome);

document.querySelector('#appGrid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-app]');
  if (button) openApp(button.dataset.app);
});
homeScreen.addEventListener('click', (event) => {
  const widget = event.target.closest('[data-widget]');
  if (widget) openApp(widget.dataset.widget);
});
document.querySelector('.dock').addEventListener('click', (event) => {
  const button = event.target.closest('[data-app]');
  if (button) openApp(button.dataset.app);
});
controlCenter.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-toggle]');
  const quickApp = event.target.closest('[data-quick-app]');
  if (toggle) {
    toggle.classList.toggle('active');
    showToast(`${toggle.dataset.toggle[0].toUpperCase() + toggle.dataset.toggle.slice(1)} ${toggle.classList.contains('active') ? 'on' : 'off'}`);
  }
  if (quickApp) openApp(quickApp.dataset.quickApp);
});

document.querySelectorAll('[data-lock-action]').forEach((button) => {
  button.addEventListener('click', () => showToast(button.dataset.lockAction === 'flash' ? 'Flashlight on' : 'Camera ready'));
});
appWindow.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-app]')) goHome();
  if (event.target.closest('[data-setting-toggle]')) event.target.closest('[data-setting-toggle]').classList.toggle('on');
  const safariAction = event.target.closest('[data-safari]');
  const safariLink = event.target.closest('[data-safari-link]');
  if (safariAction) {
    const action = safariAction.dataset.safari;
    if (action === 'back') moveSafariHistory(-1);
    if (action === 'forward') moveSafariHistory(1);
    if (action === 'reload') { renderSafari(); showToast('Page reloaded'); }
    if (action === 'share') showToast('Link copied');
    if (action === 'tabs') showToast('1 tab open');
  }
  if (safariLink) navigateSafari(safariLink.dataset.safariLink);
});
appWindow.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-safari-form]')) return;
  event.preventDefault();
  navigateSafari(event.target.querySelector('[aria-label="Address"]').value);
});

let touchStartY = 0;
document.querySelector('#phoneScreen').addEventListener('touchstart', (event) => { touchStartY = event.touches[0].clientY; }, { passive: true });
document.querySelector('#phoneScreen').addEventListener('touchend', (event) => {
  const distance = touchStartY - event.changedTouches[0].clientY;
  if (distance > 55 && !isUnlocked) unlock();
  if (distance > 55 && isUnlocked && event.changedTouches[0].clientY < 160) openControlCenter();
}, { passive: true });
