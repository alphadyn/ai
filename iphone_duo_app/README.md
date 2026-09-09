# iPhone Duo Simulator

A completely standalone iPhone Duo simulation built with plain HTML, CSS, and JavaScript. It has no build step and no external runtime dependencies.

## Included

- Responsive iPhone Duo handset with lock screen, live clock, Dynamic Island, swipe unlock, home screen, Control Center, and home indicator
- Simulated Messages, Camera, Photos, Music, Safari, Notes, Wallet, Settings, Calendar, Weather, Phone, Mail, and Calculator apps
- Desktop Duo companion display with Mirror, Focus, and Share actions
- Offline Safari-style local pages and navigation history
- Mobile layout that collapses the companion panel below the handset

## Run

Open [index.html](index.html) directly in a browser, or serve this folder from the repository root:

```bash
python3 -m http.server 8000 --directory iphone_duo_app
```

Then visit <http://localhost:8000>.
