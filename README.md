# GeoPresence

Geo-tagged attendance & task management PWA for municipal field employees.
Supervisors manage a ward, assign daily tasks and monitor attendance; employees check in/out with a live selfie + GPS and complete their tasks.

**Stack:** React 19 · Vite · Tailwind CSS 4 · Supabase (Auth, PostgreSQL, Storage) · React Leaflet + OpenStreetMap · Context API · Vercel

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173.

> **No Supabase keys? No problem.** If `.env` is missing, the app runs in **Demo Mode**: all data (Ward 5 seed data included) lives in the browser's localStorage. Use the **Quick demo login** buttons on the login page.
> Note: the camera and GPS need HTTPS or `localhost`.

## Connect Supabase (real backend)

1. Create a project at https://supabase.com.
2. SQL Editor → run [`supabase/schema.sql`](supabase/schema.sql), then [`supabase/seed.sql`](supabase/seed.sql) (demo data).
3. Authentication → Providers → Email: for demos, turn **off** "Confirm email" (so sign-up logs in immediately).
4. `cp .env.example .env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
5. `npm run dev`

## Demo accounts (password `Demo@123`)

| Role       | Email                           |
| ---------- | ------------------------------- |
| Supervisor | `rajesh.patil@geopresence.demo` |
| Employee   | `sahil@geopresence.demo` (also `amit@`, `rohit@`, `priya@`) |

## Deploy to Vercel

1. Push this repo to GitHub.
2. Vercel → **Add New → Project** → import the repo (Framework preset: **Vite**, build `npm run build`, output `dist`).
3. Add Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and optionally `VITE_SHOW_DEMO_LOGINS`).
4. Deploy. [`vercel.json`](vercel.json) already rewrites all routes to `index.html` for the SPA.
5. Supabase → Authentication → URL Configuration: set **Site URL** to your Vercel URL.

More detail in [`ai/DEPLOYMENT.md`](ai/DEPLOYMENT.md). Project notes for AI assistants/developers live in [`ai/`](ai/).

## Routes

| Path | Who |
| --- | --- |
| `/auth/login`, `/auth/register` | public |
| `/supervisor/dashboard`, `/supervisor/tasks`, `/supervisor/attendance`, `/supervisor/map` | supervisor |
| `/employee/dashboard`, `/employee/history` | employee |

## Scripts

- `npm run dev` – dev server
- `npm run build` – production build (+ service worker)
- `npm run preview` – preview the build
- `npm run icons` – regenerate PNG app icons
