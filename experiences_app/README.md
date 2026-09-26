# Experiences

A browser-based app for recording trips, Experiences, and named Events with maps, locations, and media. The logged-out home page introduces the app through a welcome screen; sign-in is required before creating or exploring private content.

## Features
- **Check in** by typing a known place name (city, address, landmark); it's geocoded into coordinates
  and dropped as a pin on an interactive map — no browser location permission required
- **Map display** built with [Leaflet](https://leafletjs.com/) and [CARTO](https://carto.com/basemaps) basemap tiles (built from OpenStreetMap data)
- **Check-ins** are listed with place name or photo filename, coordinates, and timestamp, and
  persisted permanently in Supabase so they are available across browsers and page refreshes
- **Multi-user accounts**: sign up and sign in with a unique username; each user has private trips and check-ins
- **Welcome and access control**: anyone can view the home-page welcome screen, while continuing into trips or Experiences requires signing in or creating an account
- **Trips**: create, reorder, and switch between multiple groups of check-ins; the first trip is the default shown at login
- **Experiences and events**: build private or public Experience collections, then add named Events with a date/time, location, description, and photo, video, or audio attachments
- **Event maps**: open an Experience to see all Event pins on a dedicated map, select an Event card to focus its pin, and reset the map to show every Event
- **Location picking**: find a city, region, or country by name, or choose a precise Event location by clicking the Event creation or editing map
- **Experience links**: every Experience has a stable copyable URL; enable its Public toggle to open a standalone shared Experience page where visitors can view its map and add or edit named Events with a location, date/time, description, and attachments. Public share links show an Experience-specific mobile preview with its title, description, event count, and first public image
- **Message preview artwork**: links use a simple square map illustration with tourist photos visibly connected to their pins, plus a concise app description. The PNG artwork is supported by common message-preview crawlers. Open [share-preview.html](share-preview.html) to see the mobile Messages card mockup
- **Public trip links**: copy a URL to share a read-only trip with anyone; visitors to the home page see the featured public trip by default
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
cd experiences_app
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## Deploy mobile share previews
Public Experience links can use a Supabase Edge Function to return per-Experience Open Graph and Twitter metadata to message previews, plus a compact mobile landing card with an **Open this Experience** link. The function only looks up Experiences marked public; private links continue to open the app directly. Until the function is deployed and enabled, existing direct app links keep working with the generic app preview.

Deploy it to the same Supabase project configured in [supabase-config.js](supabase-config.js):

```bash
supabase functions deploy experience-share --project-ref YOUR_PROJECT_REF
```

The function uses Supabase's automatically provided project URL and anonymous key. [supabase/config.toml](supabase/config.toml) disables JWT verification for this public preview endpoint; the function still filters every lookup to public Experiences and relies on the existing anonymous RLS policies. After deploying, set `sharePreviewEnabled: true` in the `window.CHECKIN_MAP_SUPABASE` object in [supabase-config.js](supabase-config.js), then redeploy the static app. Set the `APP_BASE_URL` Edge Function secret if the app is hosted somewhere other than `https://alphadyn.github.io/ai/experiences_app/`.

## How to use
1. Open the app to view the welcome screen. Choose **Log in** or **Sign up** before starting a trip or exploring Experiences, then choose an existing trip or create a new one. Type a known location (e.g. "Paris, France" or "350 Fifth Avenue, New York") into the check-in box
   and click **Check In**. A marker appears on the map and the check-in is added to the top of the
  "Check-Ins" list.
2. Right-click any point on the map and choose **Drop pin** to add a coordinate check-in. Open its
  Edit screen to add image, video, or audio files to the location.
3. Click **Choose a photo** and pick a JPEG photo taken with a phone or camera that recorded GPS data.
  If the photo has location data, a marker appears on the map and the photo is added to both the
  "Check-Ins" history and the photo list below.
4. Open **Experiences** in the header and create an Experience. Open it to view its Event map, then use **+** to add an Event with a name, location, time, description, and attachments. Use **Edit** on an Event to revise its details, media, or map location.

## Main files
- `index.html` — page structure (map, check-in form, check-in list, photo upload)
- `app.js` — Leaflet map setup, location search/check-in logic, EXIF GPS extraction, and rendering
- `styles.css` — layout and visual styling

## Notes
- Check-in locations are stored in Supabase, and media files are stored in the configured Supabase Storage bucket.
- Run [supabase-schema.sql](supabase-schema.sql) in the Supabase SQL editor before using the app.
- Re-run that schema after app updates; it uses idempotent migrations for fields such as `avatar_url`.
- Existing deployments can add Experiences and Events without resetting data by running [experiences-migration.sql](experiences-migration.sql) in the Supabase SQL editor, then refreshing the app. Re-run it after Experience updates to apply idempotent fields and policies such as `event_name`, collection ordering, public Event creation, and attachment permissions.
- Set the project URL and anon key in [supabase-config.js](supabase-config.js).
- Enable email/password authentication in Supabase Auth. Promote the first administrator by changing their
  profile `role` to `admin` in `checkin_map_profiles`.
- Username login uses an internal Supabase Auth identity, so enable the Supabase Email provider and disable
  mandatory email confirmation for this username-only flow in the Supabase Auth settings. Users still enter
  only a username in the app.
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
