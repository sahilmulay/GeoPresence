# Demo Guide (≈5 minutes)

Preparation: re-run `supabase/seed.sql` (re-dates data to today). Open two browser windows: supervisor (desktop/projector) and employee (phone or second window).

1. **Login page** – point out the two roles; use *Quick demo login*.
2. **Employee (Sahil)** – dashboard shows Welcome Sahil, Ward 5, supervisor Rajesh Patil.
   - Tap **CHECK IN** → selfie → location ready → *Confirm* → "Attendance Recorded Successfully".
   - Tasks: **Start Work** on *Road Cleaning*, **Mark Completed** on *Drain Cleaning*.
   - *History* tab: records with time and coordinates.
3. **Supervisor (Rajesh)** – dashboard cards (Total / Present / Absent / Tasks), employee list with status.
   - *Tasks*: create "Road Cleaning – Clean Market Area" for Amit → show it in the list.
   - *Attendance*: check-in/out times, status, location, selfie thumbnail (tap to enlarge). Change the date.
   - *Map*: green pins = present, red = flagged; tap a pin → name, ward, timestamp, coordinates.
4. **Registration** – register a new employee in Ward 5 → they instantly see Rajesh as supervisor and appear in his list.
5. Mention: installable PWA, mobile-first, works without keys in demo mode.

Demo mode: use the banner's *Reset demo data* to restore the starting state.
