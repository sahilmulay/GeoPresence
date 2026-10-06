# Architecture

## Stack
React 19 + Vite 8 + Tailwind CSS 4 (`@tailwindcss/vite`), `react-router-dom` (BrowserRouter), `@supabase/supabase-js`, `react-leaflet` 5 + `leaflet`, `vite-plugin-pwa`. State: React Context (`AuthContext`) + a tiny `useData` hook. No Redux, no UI library.

## Folder structure

```
src/
  main.jsx, App.jsx           entry + routes (guards per role)
  index.css                   Tailwind import + global styles
  context/AuthContext.jsx     profile/role/loading, signIn/signUp/signOut
  lib/
    api.js                    picks backend: Supabase if env set, else demo mode
    supabaseApi.js            real backend (auth, tables, storage upload)
    localApi.js               demo backend (localStorage + Ward 5 seed data)
    useData.js                fetch hook with optional polling
    wardData.js               supervisor data hook + todaySummary()
    device.js                 geolocation + image resize helpers
    format.js                 date/time/coordinate helpers
  components/
    Layout.jsx                header, bottom nav (mobile) / top nav (desktop), demo banner
    guards.jsx                RequireRole, PublicOnly, RootRedirect
    AttendanceCapture.jsx     camera -> GPS -> upload -> success flow
    ui.jsx                    Card, Button, Badge, Field, Avatar, ...
  pages/{auth,employee,supervisor}/...
supabase/schema.sql, seed.sql
scripts/generate-icons.mjs    dependency-free PNG icon generator
public/                       icons (svg + png)
```

## Data layer
Both backends implement the same interface (`subscribe, signUp, signIn, signOut, getProfile, listEmployees, listAttendance, addAttendance, listTasks, createTask, updateTaskStatus`). **Any new data feature must be implemented in both files.** Row visibility in Supabase is enforced by RLS (supervisor sees their ward; employee sees only their own data), so the client calls do not filter by ward.

## Auth flow
1. `signUp` sends `role`, `name`, `ward_no` as user metadata.
2. DB trigger `handle_new_user` creates the `supervisors`/`employees` row and links employee ↔ supervisor by ward (and back-fills when the supervisor registers later).
3. `AuthContext` loads the profile (role) → `PublicOnly` redirects to the correct dashboard; `RequireRole` protects dashboards.

## Attendance flow
`AttendanceCapture`: `getUserMedia` selfie (fallback: `<input capture>`) + `getCurrentPosition` in parallel → resize to ≤640 px JPEG → upload to Storage bucket `selfies/{employeeId}/…` → insert row (`FLAGGED` if accuracy > 100 m).

## Live updates
Supervisor pages poll every 10–15 s (`useData({poll})`) so check-ins appear without refresh. No realtime subscriptions (kept simple).

## Decisions
- Demo mode exists so `npm run dev` always works and the demo cannot fail on network/keys.
- Map uses `CircleMarker` (no Leaflet marker image assets → no bundler icon issues).
- Task "area" is part of the description text (the required schema has no area column).
- Present today = has a CHECKIN today; Absent = none.
