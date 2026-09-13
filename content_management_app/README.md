# Nexus Content Management System (CMS)

A modern, full-featured web-based Content Management System (CMS) for uploading, displaying, playing, searching, ordering, editing, and managing all kinds of digital media and documents (text, code, documents, audio, video, images, PDFs, archives, and custom binary formats) with persistent Supabase storage.

![Nexus CMS Banner](https://img.shields.io/badge/Status-Complete-brightgreen)
![Supabase](https://img.shields.io/badge/Storage-Supabase-3ECF8E)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Python%20Standard%20Library-orange)

---

## Key Features

### 1. Universal File Upload & Custom Metadata
- **Any File Format**: Upload images, audio, video, markdown, code, PDFs, spreadsheets, compressed archives, and custom binary files.
- **Pre-Upload & Post-Upload Property Editor**:
  - Display Title / Name
  - Filename & extension preservation or renaming
  - Interactive Tag pills (with enter/comma addition, suggested tags, and color-coded chips)
  - Date & Time selector (with "Now" quick-set button)
  - Category selector (Documents, Design & Media, Engineering & Code, Audio & Music, Video Production, Finance, Marketing, etc.)
  - Author / Creator attribute
  - Status management (Published, Draft, In Review, Archived)
  - 5-star priority / quality rating
  - Multi-line Description / Notes
  - Arbitrary Custom Key-Value metadata pairs (e.g., `Resolution: 4K`, `License: CC-BY`, `BPM: 128`, `Version: 2.5`)
- **Drag & Drop**: Full-window drag-and-drop backdrop and dedicated dropzone.

### 2. Rich Media Display & Fullscreen Playback
- **HTML5 Video Player**: Fluid canvas, custom speed selector (0.5x, 1x, 1.25x, 1.5x, 2x), loop toggle, Picture-in-Picture, and immersive Fullscreen mode (`F` shortcut).
- **Interactive Audio Player**: Web Audio API frequency spectrum / waveform visualizer with real-time gradient canvas animation, playback scrubber, volume control, track metadata, and rotating vinyl disc visualization.
- **High-Resolution Image Lightbox**: Zoom in (`+`), zoom out (`-`), reset zoom, 90° rotation, horizontal flip, vertical flip, and lightbox presentation mode.
- **Code & Markdown Reader**: Monospace syntax preview, rendered vs raw markdown toggle, line formatting, and one-click copy to clipboard.
- **PDF & Document Embed**: In-browser document viewer with download action.
- **Previous / Next Keyboard Navigation**: Seamless navigation across media items with `←` and `→` arrow keys.
- **Collapsible Metadata Inspector**: Side panel in viewer displaying all properties, tags, and custom metadata with quick edit access.

### 3. Multi-Criteria Ordering & Sorting
- Sort by **Date & Time** (Newest first, Oldest first)
- Sort by **Name / Display Title** (A → Z, Z → A)
- Sort by **Filename** (A → Z, Z → A)
- Sort by **Size** (Largest first, Smallest first)
- Sort by **Type & Category** (A → Z)
- Sort by **Rating / Priority** (Highest first)

### 4. Omnisearch & Multi-Dimensional Filtering
- **Omnisearch Bar** (`/` keyboard shortcut): Real-time matching across name, filename, extension, tags, author, category, description, and custom metadata properties.
- **Sidebar Category Navigation**: One-click filtering by media type (All, Images, Videos, Audio, Documents, Code, Starred).
- **Status Filter**: All, Published, Draft, In Review, Archived.
- **Dynamic Tag Cloud**: Displays all active tags with item counts; supports multi-tag intersection filtering.
- **Date Range Presets**: Any time, Today, Past 7 days, Past 30 days, Past year.
- **Size Range Presets**: Any size, < 1MB, 1MB–10MB, > 10MB.
- **Active Filter Ribbon**: Displays current active filter chips with individual remove buttons and a "Clear All" action.

### 5. In-Place Property Editing & File Replacement
- Complete property editor modal for existing files.
- Live modification of title, filename, tags, category, author, status, rating, description, and key-value pairs.
- "Replace File" feature to swap underlying file binaries while preserving or updating metadata attributes.

### 6. Deletion, Batch Actions & Safety Undo
- **Single File Delete**: Confirmation modal with item preview.
- **Multi-Select Batch Actions**:
  - Select all / invert selection
  - Batch Delete selected items
  - Batch Star / Unstar
  - Batch Tag Assignment
  - Batch File Download
- **Admin Screen**: Database-level controls are available from the Admin screen in the sidebar.
- **Clear All Files**: The Admin screen provides a full database wipe action; users must verify the deletion in a confirmation dialog before any files are removed.
- **Undo Stack**: Toast notification with instant "Undo" button to restore accidentally deleted files.

### 7. Persistent Supabase Database Storage & Data Portability
- **Exclusive Persistent Database Storage (`media_items`)**: All data storage, edits, metadata, tags, and media assets are saved to the configured Supabase table through PostgREST. Browser local storage and IndexedDB are not used for CMS records.
- **Database Status Indicator**: Live status badge in the UI displaying Supabase connectivity and record counts.
- **Export & Import Backup Tools**: One-click JSON backup export and import to transfer or restore data from Supabase.
- **Preloaded Sample Data**: Includes sample vector image, audio track with synthesized melody, Markdown architecture doc, JavaScript visualizer script, and video motion demo stored in the `media_items` table.

### 8. Direct Entry URLs & Deep Linking
- **Direct Web URLs**: Every entry has a direct URL (e.g. `http://localhost:8000/?item=sample_img_1`) that can be copied and opened in any browser to launch the media viewer.
- **Raw Media Streaming**: Server endpoints like `/media/:id` stream raw binary media files directly.
- **One-Click Link Copying**: Copy link buttons on cards, list rows, and in the media viewer inspector.

---

## REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/rest/v1/media_items` | Retrieve media items through Supabase PostgREST |
| `POST` | `/rest/v1/media_items?on_conflict=id` | Insert or update media items |
| `DELETE` | `/rest/v1/media_items?id=eq.<id>` | Delete a media item |
| `DELETE` | `/rest/v1/media_items?id=not.is.null` | Clear all media items |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `/` | Focus Omnisearch Bar |
| `U` | Open Upload Modal |
| `Esc` | Close Modal or Exit Fullscreen Viewer |
| `F` | Toggle Fullscreen in Media Viewer |
| `←` / `→` | Previous / Next Item in Media Viewer |
| `Space` | Play / Pause Audio or Video |
| `Cmd` / `Ctrl` + `A` | Select All Visible Items |
| `Del` / `Backspace` | Delete Selected Items |
| `?` | Open Keyboard Shortcuts Help Modal |

---

## Quick Start & Running

Configure Supabase:

1. Run [supabase-schema.sql](supabase-schema.sql) in the Supabase SQL Editor.
2. Set the project URL and anon key in [supabase-config.js](supabase-config.js).

The schema creates the public `nexus-media` Storage bucket and its policies. Binary uploads, including videos, are stored there; the `media_items` table stores their durable public URLs.

Run the static app locally:

```bash
cd content_management_app
python3 -m http.server 8000
```
Open `http://localhost:8000` in your web browser. All uploaded files, property updates, tags, and deletions persist directly in Supabase.

For destructive database operations, open **Admin** from the sidebar and choose **Clear All Files**. The CMS asks for confirmation before deleting every indexed file, and the resulting notification provides an **Undo** action.
