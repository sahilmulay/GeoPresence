# Project Overview

**GeoPresence** – a mobile-first PWA for municipal workforce attendance and task management. Built for a project presentation / live demo, so **simplicity beats completeness**. Do not over-engineer.

## Roles

- **Supervisor** – registers with name, email, password, ward number; owns that ward. Sees employees, assigns tasks, monitors attendance, views check-in map.
- **Employee** – registers with the same fields; is automatically linked to the supervisor of their ward. Checks in/out (selfie + GPS + timestamp), works through assigned tasks, sees history.

## Core workflow (Ward 5 example)

Supervisor Rajesh Patil → employees Sahil, Amit, Rohit, Priya. Supervisor assigns tasks (e.g. "Road Cleaning") → employee starts/completes them and marks attendance → supervisor sees live status, selfies and map pins.

## Features

- Role-based registration/login (Supabase Auth) and route guards
- Employee: dashboard (welcome, ward, supervisor), CHECK IN / CHECK OUT with camera + GPS, task cards (Start Work / Mark Completed), attendance history
- Supervisor: overview cards (Total / Present / Absent / Tasks), employee list with status + task count, task creation + filtering, attendance monitoring by date (with selfie preview), Leaflet map of check-ins
- Attendance `FLAGGED` when GPS accuracy is worse than 100 m
- PWA: installable, service worker, offline app shell
- **Demo mode** (no Supabase env vars): browser-localStorage backend with identical seed data

## Design rules

White/light-grey (`#F5F5F5`) UI, light grey borders, simple cards; soft blue (actions), green (success), red (alerts). No gradients, no dark theme. Mobile first (360–430 px), 48 px+ touch targets, bottom navigation on mobile, top navigation on ≥768 px.

## Routes

`/auth/login`, `/auth/register`, `/supervisor/{dashboard,tasks,attendance,map}`, `/employee/{dashboard,history}`
