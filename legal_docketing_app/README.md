# Legal Docketing App

This folder contains a fully functional, browser-based legal docketing application designed for law firms and legal teams that need to manage matters, deadlines, and tasks in one place.

## Features
- Dashboard summary cards for matters, pending tasks, and upcoming deadlines
- Matter management with case title, client, status, court, hearing date, and attorney details
- Task tracker with priority levels, due dates, completion toggles, and deletion
- Search and filtering so users can focus on the right matters quickly
- Local persistence using browser storage, so records remain available after refreshes

## How to run
Open the application directly in a browser:

```bash
open legal_docketing_app/index.html
```

If you prefer a local server, run:

```bash
cd legal_docketing_app
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## Project structure
- `index.html` — main layout and UI structure
- `styles.css` — polished, professional visual design
- `app.js` — application logic, state handling, and local storage persistence

## Notes
- The app is intentionally lightweight and dependency-free.
- It is suitable for demos, prototypes, or as a foundation for a larger legal case-management system.
