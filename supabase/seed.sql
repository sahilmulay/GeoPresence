-- =====================================================================
-- GeoPresence - demo seed data (Ward 5)
-- Run AFTER schema.sql, in Supabase Dashboard -> SQL Editor.
-- Safe to re-run: it removes the old demo users first and re-dates the attendance to "today".
--
-- Demo logins (password for all: Demo@123)
--   Supervisor : rajesh.patil@geopresence.demo
--   Employees  : sahil@ / amit@ / rohit@ / priya@  geopresence.demo
-- =====================================================================

-- 0) clean previous demo data (cascades to profiles, attendance, tasks)
delete from auth.users where email like '%@geopresence.demo';

-- helper: IST wall-clock time on a day offset, never in the future
create or replace function pg_temp.ts(day_offset int, h int, m int default 0)
returns timestamptz language sql as $$
  select least(
    (((now() at time zone 'Asia/Kolkata')::date + day_offset) + make_time(h, m, 0)) at time zone 'Asia/Kolkata',
    now() - interval '1 minute'
  )
$$;

-- 1) auth users (the on_auth_user_created trigger creates supervisor/employee rows)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  crypt('Demo@123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('role', u.role, 'name', u.name, 'ward_no', 5),
  now() + (u.ord || ' seconds')::interval,  -- supervisor first, so employees get supervisor_id
  now(),
  '', '', '', ''
from (values
  (1, 'a0000000-0000-4000-8000-000000000001'::uuid, 'supervisor', 'Rajesh Patil',   'rajesh.patil@geopresence.demo'),
  (2, 'a0000000-0000-4000-8000-000000000002'::uuid, 'employee',   'Sahil Mulay',    'sahil@geopresence.demo'),
  (3, 'a0000000-0000-4000-8000-000000000003'::uuid, 'employee',   'Amit Jadhav',    'amit@geopresence.demo'),
  (4, 'a0000000-0000-4000-8000-000000000004'::uuid, 'employee',   'Rohit Shinde',   'rohit@geopresence.demo'),
  (5, 'a0000000-0000-4000-8000-000000000005'::uuid, 'employee',   'Priya Kulkarni', 'priya@geopresence.demo')
) as u(ord, id, role, name, email)
order by u.ord;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users
where email like '%@geopresence.demo';

-- 2) attendance - today (Rohit is absent, Priya is flagged), photos left empty -> initials avatar
insert into public.attendance (employee_id, photo_url, latitude, longitude, "timestamp", check_type, status) values
  ('a0000000-0000-4000-8000-000000000002', null, 18.51960, 73.85530, pg_temp.ts(0, 8, 58),  'CHECKIN',  'PRESENT'),
  ('a0000000-0000-4000-8000-000000000003', null, 18.53140, 73.84460, pg_temp.ts(0, 8, 50),  'CHECKIN',  'PRESENT'),
  ('a0000000-0000-4000-8000-000000000003', null, 18.53150, 73.84470, pg_temp.ts(0, 13, 5),  'CHECKOUT', 'PRESENT'),
  ('a0000000-0000-4000-8000-000000000005', null, 18.50740, 73.80770, pg_temp.ts(0, 9, 15),  'CHECKIN',  'FLAGGED');

-- 3) attendance - previous 3 days for everyone (history screens)
insert into public.attendance (employee_id, photo_url, latitude, longitude, "timestamp", check_type, status)
select e.id, null,
       e.lat + (random() - 0.5) * 0.0006, e.lng + (random() - 0.5) * 0.0006,
       pg_temp.ts(d.d, case t.kind when 'CHECKIN' then 9 else 17 end, floor(random() * 20)::int),
       t.kind, 'PRESENT'
from (values
  ('a0000000-0000-4000-8000-000000000002'::uuid, 18.5196, 73.8553),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 18.5314, 73.8446),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 18.5018, 73.8636),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 18.5074, 73.8077)
) as e(id, lat, lng)
cross join (values (-1), (-2), (-3)) as d(d)
cross join (values ('CHECKIN'), ('CHECKOUT')) as t(kind);

-- 4) tasks
insert into public.tasks (title, description, assigned_by, assigned_to, ward_no, status, created_at) values
  ('Road Cleaning',          'Area: Market Area. Sweep the main road and clear debris before 11 AM.',  'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 5, 'PENDING',     pg_temp.ts(0, 8)),
  ('Drain Cleaning',         'Area: Lane 3. Clear blocked drain near the bus stop.',                    'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 5, 'IN_PROGRESS', pg_temp.ts(0, 8)),
  ('Garbage Collection',     'Area: Gandhi Nagar. Collect garbage from all community bins.',            'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 5, 'IN_PROGRESS', pg_temp.ts(0, 8)),
  ('Footpath Cleaning',      'Area: Shivajinagar. Clean footpath outside the market gate.',             'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 5, 'COMPLETED',   pg_temp.ts(-1, 8)),
  ('Street Light Repair',    'Area: Shivaji Chowk. Check and fix 5 street lights.',                     'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 5, 'PENDING',     pg_temp.ts(0, 8)),
  ('Public Toilet Cleaning', 'Area: Bus Stand. Clean and restock community toilets.',                   'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 5, 'COMPLETED',   pg_temp.ts(-1, 8));
