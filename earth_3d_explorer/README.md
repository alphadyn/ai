# 3D Earth Explorer

An interactive browser app that renders a 3D model of the Earth, lets you inspect the
latitude/longitude of any point on its surface, and measure the great-circle (surface)
distance between any two points you click.

## Features
- **3D rotating globe** built with [Three.js](https://threejs.org/), textured with a real
  earth image, drag-to-rotate and scroll/pinch-to-zoom via `OrbitControls`
- **Country boundaries** overlaid on the globe surface, loaded from a public GeoJSON dataset
- **Inspect Point mode**: click anywhere on the globe to drop a marker and see its latitude,
  longitude, hemisphere, and the country it falls within (with a link to that country's
  Wikipedia article, opened in a new tab)
- **Measure Distance mode**: click two points on the globe to drop markers, draw a great-circle
  arc between them, and see the surface distance in kilometers and miles
- Distance is computed from the true angular separation between the two points on the sphere
  (not a straight line through the globe), so it reflects real-world surface distance

## Run it
This app loads Three.js and the earth texture from public CDNs, so an internet connection is
required. Because it uses ES modules, open it through a local server rather than the `file://`
protocol:

```bash
cd earth_3d_explorer
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## How to use
1. **Inspect Point** (default mode): click anywhere on the globe. A marker appears and the side
   panel shows the latitude, longitude, hemisphere, and country (if the point falls on land) for
   that point, along with a link to open that country's Wikipedia article in a new tab.
2. Switch to **Measure Distance** mode using the toggle at the top. Click a first point (green
   marker), then a second point (yellow marker). An arc is drawn between them and the panel shows
   the surface distance. Clicking again after two points are set starts a new measurement.
3. Use **Reset Points** to clear the current measurement.

## Main files
- `index.html` — page structure, mode toggle, and side panels
- `app.js` — Three.js scene/globe setup, raycasting for click detection, lat/lon conversion,
  and great-circle distance calculation
- `styles.css` — layout and visual styling

## Notes
- Latitude/longitude are derived from the clicked point's position on the sphere; no external
  geocoding service is used.
- Distance uses the standard great-circle formula (angular separation between two unit vectors
  multiplied by Earth's mean radius, 6371 km).
- Country boundaries are loaded from a public GeoJSON dataset of national borders at page load
  and rendered as line segments just above the globe surface.
- The same GeoJSON dataset is used to determine which country (if any) a clicked point falls
  within, via a point-in-polygon test; ocean/unclaimed points show no country or Wikipedia link.
