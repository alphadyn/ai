# Check-In Map

A browser-based app for checking in known locations on a map by name, keeping a running history of
your last 10 check-ins, and mapping the GPS location embedded in uploaded photos.

## Features
- **Check in** by typing a known place name (city, address, landmark); it's geocoded into coordinates
  and dropped as a pin on an interactive map — no browser location permission required
- **Map display** built with [Leaflet](https://leafletjs.com/) and [CARTO](https://carto.com/basemaps) basemap tiles (built from OpenStreetMap data)
- **Last 10 check-ins** are listed with place name or photo filename, coordinates, and timestamp, and
  persisted in the browser's local storage so they survive a page refresh
- **Photo upload**: choose a JPEG photo with embedded GPS EXIF data and the app reads the coordinates
  and plots a separate marker for where the photo was taken
- Clear status messages if a typed location can't be found or a photo has no embedded GPS data

## Run it
This app loads Leaflet, the CARTO basemap tiles, and the EXIF-parsing library from public CDNs, so an
internet connection is required. Open [index.html](index.html) directly in a browser, or serve the
folder locally:

```bash
cd checkin_map_app
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## How to use
1. Type a known location (e.g. "Paris, France" or "350 Fifth Avenue, New York") into the check-in box
   and click **Check In**. A marker appears on the map and the check-in is added to the top of the
   "Last 10 Check-Ins" list.
2. Click **Choose a photo** and pick a JPEG photo taken with a phone or camera that recorded GPS data.
  If the photo has location data, a marker appears on the map and the photo is added to both the
  "Last 10 Check-Ins" history and the photo list below.

## Main files
- `index.html` — page structure (map, check-in form, check-in list, photo upload)
- `app.js` — Leaflet map setup, location search/check-in logic, EXIF GPS extraction, and rendering
- `styles.css` — layout and visual styling

## Notes
- Check-in history is stored in the browser's local storage on the device you use, not on a server.
- Location search (turning a typed place name into coordinates) uses the free
  [Nominatim](https://nominatim.org/) API.
- Photos are never uploaded anywhere — EXIF data is read entirely in the browser.

## Test the project
Run the repository-wide test suite from the project root:

```bash
./run_tests.sh
```

## Generate the report
Run the generator script to create a simple HTML artifact for this project:

```bash
python3 generate_report.py
```

This writes [generated_report.html](generated_report.html) in the same folder.
