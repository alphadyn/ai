# Northstar Health EHR

A polished, single-page electronic health record web application designed to look and feel like a modern clinical dashboard. The experience combines patient search, vitals, medication tracking, appointments, billing context, and encounter documentation in one responsive interface.

## Features

- Patient queue with live selection and fast search
- Detailed patient profile with demographics, vitals, medications, allergies, and labs
- Appointment timeline for the active patient
- Care coordination snapshot with provider and billing context
- Encounter form for documenting patient visits and follow-up plans
- Local persistence using browser storage so notes remain available after refresh

## Project structure

- index.html — app shell and dashboard layout
- styles.css — modern responsive UI styling
- app.js — patient data, UI rendering, interactions, and local storage
- docs/USER_GUIDE.md — usage guide and customization notes

## How to run

Open the app directly in a browser from the project folder:

```bash
cd ehr_web_app
open index.html
```

For a local server:

```bash
cd ehr_web_app
python3 -m http.server 8000
```

Then browse to http://localhost:8000.

## Notes

This is a front-end prototype for demonstration and design purposes. It can be expanded into a full-stack system with authentication, patient records APIs, and real clinical workflows.
