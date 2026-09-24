# Check-In Map

A browser-based app for checking in known locations on a map by name, keeping a running history of
your last 100 check-ins, and mapping the GPS location embedded in uploaded photos.

## Features
- **Check in** by typing a known place name (city, address, landmark); it's geocoded into coordinates
  and dropped as a pin on an interactive map — no browser location permission required
- **Map display** built with [Leaflet](https://leafletjs.com/) and [CARTO](https://carto.com/basemaps) basemap tiles (built from OpenStreetMap data)
- **Check-ins** are listed with place name or photo filename, coordinates, and timestamp, and
  persisted permanently in Supabase so they are available across browsers and page refreshes
- **Multi-user accounts**: sign up and sign in with Supabase Auth; each user has private trips and check-ins
- **Trips**: create and switch between multiple groups of check-ins
- **Public trip links**: copy a URL to share a read-only trip with anyone
- **Admin area**: administrators can edit user profiles, trip names, and any check-in, or delete trips and check-ins
- **Map pinning**: right-click any point on the map and choose **Drop pin** to save that coordinate as a check-in
- **Media attachments**: attach up to five local image, video, or audio files to each check-in
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
1. Create an account or sign in, then choose an existing trip or create a new one. Type a known location (e.g. "Paris, France" or "350 Fifth Avenue, New York") into the check-in box
   and click **Check In**. A marker appears on the map and the check-in is added to the top of the
  "Check-Ins" list.
2. Right-click any point on the map and choose **Drop pin** to add a coordinate check-in. Open its
  Edit screen to add image, video, or audio files to the location.
3. Click **Choose a photo** and pick a JPEG photo taken with a phone or camera that recorded GPS data.
  If the photo has location data, a marker appears on the map and the photo is added to both the
  "Check-Ins" history and the photo list below.

## Main files
- `index.html` — page structure (map, check-in form, check-in list, photo upload)
- `app.js` — Leaflet map setup, location search/check-in logic, EXIF GPS extraction, and rendering
- `styles.css` — layout and visual styling

## Notes
- Check-in locations are stored in Supabase, and media files are stored in the configured Supabase Storage bucket.
- Run [supabase-schema.sql](supabase-schema.sql) in the Supabase SQL editor before using the app.
- Set the project URL and anon key in [supabase-config.js](supabase-config.js).
- Enable email/password authentication in Supabase Auth. Promote the first administrator by changing their
  profile `role` to `admin` in `checkin_map_profiles`.
- The schema includes a backfill for users that existed before the profile trigger was installed.
- Location search (turning a typed place name into coordinates) uses the free
  [Nominatim](https://nominatim.org/) API.
- Photo EXIF data is read in the browser; the selected photo is uploaded to Supabase Storage when it is mapped.

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
