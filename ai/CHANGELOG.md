# Changelog & Status

## 2026-10-06 – Initial MVP
- Scaffolded React 19 + Vite + Tailwind 4 PWA (manifest, service worker, PNG icons).
- Auth: role-based register/login, route guards, DB trigger-based profile creation.
- Employee: dashboard, camera+GPS attendance, tasks (start/complete), history.
- Supervisor: dashboard, employees, task assignment + filters, attendance monitoring (date picker, selfie preview), Leaflet map.
- Supabase: schema, RLS, storage bucket, seed (Ward 5). Demo-mode backend (localStorage) for key-less runs.
- Docs: README + this `ai/` folder. `vercel.json` SPA rewrite, `.env.example`.
- Verified: `npm run build` succeeds; demo backend smoke-tested in Node. **Not yet verified:** live Supabase run (SQL was written but not executed against a real project) and on-device camera/GPS.

## Known limitations / next steps
- Seeded attendance has no selfies (initials avatar shown).
- Polling (10–15 s) instead of Supabase Realtime.
- No geofence; `FLAGGED` is based only on GPS accuracy (> 100 m).
- Employees may edit any column of their own tasks via the API (UI only edits status).
- JS bundle ~466 kB (146 kB gzip); could code-split the map page.
- Possible additions: task delete/edit, geofence per ward, CSV export, Realtime.
