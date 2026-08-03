# User Guide

## Overview

Northstar Health EHR is a desktop-friendly, responsive web application for reviewing patient information, scheduling care, and recording clinical encounters. It is intentionally polished for demos, stakeholder presentations, or as a foundation for a larger healthcare product.

## Main workflow

1. Select a patient from the queue on the left.
2. Review the patient’s demographics, vitals, labs, allergies, and recent notes.
3. Use the appointment panel and care snapshot to prepare for the visit.
4. Record an encounter in the form at the bottom of the page.

## Persistence

The app stores patient data and encounter notes in your browser using local storage. Refreshing the page preserves the selected patient and saved encounter history.

## Customizing the experience

- Update the sample patient data in app.js to match your demo scenarios.
- Adjust the visuals in styles.css to match your organization’s branding.
- Add API-backed services later for real patient record management and authentication.

## Suggested next upgrades

- Role-based access for clinicians, nurses, and admins
- Real-time charting for vitals and lab trends
- Integration with a backend database or FHIR-compatible APIs
- Appointment booking and e-prescribing modules
