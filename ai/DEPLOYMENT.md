# Deployment

## 1. Supabase
1. New project at supabase.com.
2. SQL Editor: run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Authentication → Providers → Email → disable **Confirm email** (demo) – otherwise users must confirm by email before logging in (the app shows a message in that case).
4. Project Settings → API: copy **Project URL** and **anon public key**.

## 2. GitHub
```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## 3. Vercel
1. Add New → Project → import the GitHub repo. Framework: Vite (auto-detected), build `npm run build`, output `dist`.
2. Environment variables (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SHOW_DEMO_LOGINS` = `true` (optional; `false` hides quick-login buttons)
3. Deploy. `vercel.json` rewrites all paths to `index.html` so deep links/refresh work.
4. Supabase → Authentication → URL Configuration → Site URL = your Vercel URL.

## 4. Verify
- Open the Vercel URL on a phone (HTTPS → camera + GPS work).
- Log in as the demo supervisor → dashboard shows 4 employees.
- Log in as Sahil → check in with a selfie → supervisor Attendance/Map shows it within ~10 s.
- Install: browser menu → "Add to Home Screen".

## Troubleshooting
- Blank/"Demo mode" banner on Vercel → env vars missing; add them and redeploy (Vite bakes them at build time).
- "Invalid login credentials" for demo users → seed.sql was not run.
- Selfie upload fails → check bucket `selfies` exists and schema.sql storage policy was created.
- Camera not opening → needs HTTPS and permission; the app offers the phone camera app as fallback.
