# Rotating Photo Gallery

A browser-based web app that fetches 10 new random photos from the web on every page load/refresh and displays them in an auto-rotating carousel.

## Features

- 10 photos fetched live from Picsum Photos on every page load, so a new set appears each time you refresh
- Auto-rotating carousel with a progress bar
- Previous / Next navigation buttons
- Play / Pause toggle
- Clickable thumbnail strip to jump to any photo
- Keyboard navigation (Left / Right arrow keys)
- Responsive layout for desktop and mobile

## Project Structure

- `index.html` - Main page markup
- `styles.css` - App styling and responsive layout
- `app.js` - Fetches a fresh set of photo URLs and drives the carousel logic and rotation timer

## How To Run

No build tools or installation are required. An internet connection is required to load photos, since a new set is requested from Picsum Photos on every refresh.

1. Open `index.html` in any modern browser.
2. Refresh the page to get a brand-new set of 10 photos.
3. The gallery rotates automatically every 4 seconds.
4. Use the arrow buttons, thumbnails, or Left/Right keys to navigate manually.
5. Click the pause button to stop auto-rotation.

## Notes

Photos are served by [Picsum Photos](https://picsum.photos) using a randomly generated seed per image, per page load. Since the photos are fetched over the network, the app requires an active internet connection and will not work fully offline.
