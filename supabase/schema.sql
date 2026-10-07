-- =====================================================================
-- GeoPresence - Supabase schema
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.supervisors (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null,
  ward_no     integer not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.employees (
  id             uuid primary key references auth.users(id) on delete cascade,
  name           text not null,
  email          text not null,
  ward_no        integer not null,
  supervisor_id  uuid references public.supervisors(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  photo_url   text,
  latitude    double precision not null,
  longitude   double precision not null,
  "timestamp" timestamptz not null default now(),
  check_type  text not null check (check_type in ('CHECKIN', 'CHECKOUT')),
  status      text not null default 'PRESENT' check (status in ('PRESENT', 'FLAGGED')),
  created_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  assigned_by  uuid not null references public.supervisors(id) on delete cascade,
  assigned_to  uuid not null references public.employees(id) on delete cascade,
  ward_no      integer not null,
  status       text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  location_name text,
  target_lat   double precision,
  target_lng   double precision,
  radius_m     integer not null default 50,
  created_at   timestamptz not null default now()
);

create table if not exists public.task_tracking (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  latitude     double precision not null,
  longitude    double precision not null,
  distance     integer not null,
  inside_geofence boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.task_alerts (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid references public.tasks(id) on delete set null,
  employee_id  uuid references public.employees(id) on delete set null,
  employee_name text not null,
  task_title   text not null,
  distance     integer not null,
  latitude     double precision,
  longitude    double precision,
  resolved     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists attendance_employee_ts_idx on public.attendance (employee_id, "timestamp" desc);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists tasks_ward_idx on public.tasks (ward_no);
create index if not exists employees_ward_idx on public.employees (ward_no);
create index if not exists task_tracking_task_idx on public.task_tracking (task_id, created_at asc);
create index if not exists task_alerts_resolved_idx on public.task_alerts (resolved, created_at desc);

-- ---------------------------------------------------------------------
-- Auto-create the supervisor / employee row when someone registers.
-- The app passes role, name and ward_no as sign-up metadata.
-- (Works even when "Confirm email" is enabled, because it runs in the DB.)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := new.raw_user_meta_data ->> 'role';
  v_name text := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1));
  v_ward integer := nullif(new.raw_user_meta_data ->> 'ward_no', '')::integer;
begin
  if v_ward is null then
    return new;
  end if;

  if v_role = 'supervisor' then
    insert into public.supervisors (id, name, email, ward_no)
    values (new.id, v_name, new.email, v_ward);

    -- employees who registered earlier for this ward now get their supervisor
    update public.employees
       set supervisor_id = new.id
     where ward_no = v_ward and supervisor_id is null;

  elsif v_role = 'employee' then
    insert into public.employees (id, name, email, ward_no, supervisor_id)
    values (
      new.id, v_name, new.email, v_ward,
      (select s.id from public.supervisors s where s.ward_no = v_ward order by s.created_at limit 1)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Helper functions for Row Level Security (SECURITY DEFINER avoids recursion)
-- ---------------------------------------------------------------------
create or replace function public.my_ward()
returns integer
language sql stable security definer set search_path = public
as $$ select ward_no from public.supervisors where id = auth.uid() $$;

create or replace function public.my_supervisor_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select supervisor_id from public.employees where id = auth.uid() $$;

create or replace function public.ward_of_employee(emp uuid)
returns integer
language sql stable security definer set search_path = public
as $$ select ward_no from public.employees where id = emp $$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.supervisors enable row level security;
alter table public.employees   enable row level security;
alter table public.attendance  enable row level security;
alter table public.tasks       enable row level security;

drop policy if exists "supervisors: read self or own supervisor" on public.supervisors;
create policy "supervisors: read self or own supervisor" on public.supervisors
  for select to authenticated
  using (id = auth.uid() or id = public.my_supervisor_id());

drop policy if exists "employees: read self or ward employees" on public.employees;
create policy "employees: read self or ward employees" on public.employees
  for select to authenticated
  using (id = auth.uid() or ward_no = public.my_ward());

drop policy if exists "attendance: read own or ward" on public.attendance;
create policy "attendance: read own or ward" on public.attendance
  for select to authenticated
  using (employee_id = auth.uid() or public.ward_of_employee(employee_id) = public.my_ward());

drop policy if exists "attendance: employee inserts own" on public.attendance;
create policy "attendance: employee inserts own" on public.attendance
  for insert to authenticated
  with check (employee_id = auth.uid());

drop policy if exists "tasks: read assigned or ward" on public.tasks;
create policy "tasks: read assigned or ward" on public.tasks
  for select to authenticated
  using (assigned_to = auth.uid() or ward_no = public.my_ward());

drop policy if exists "tasks: supervisor creates for own ward" on public.tasks;
create policy "tasks: supervisor creates for own ward" on public.tasks
  for insert to authenticated
  with check (assigned_by = auth.uid() and ward_no = public.my_ward());

drop policy if exists "tasks: update assigned or ward" on public.tasks;
create policy "tasks: update assigned or ward" on public.tasks
  for update to authenticated
  using (assigned_to = auth.uid() or ward_no = public.my_ward())
  with check (assigned_to = auth.uid() or ward_no = public.my_ward());

drop policy if exists "tasks: supervisor deletes own ward" on public.tasks;
create policy "tasks: supervisor deletes own ward" on public.tasks
  for delete to authenticated
  using (ward_no = public.my_ward());

-- ---------------------------------------------------------------------
-- Storage: public "selfies" bucket, users may only upload into their own folder
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('selfies', 'selfies', true)
on conflict (id) do update set public = true;

drop policy if exists "selfies: upload to own folder" on storage.objects;
create policy "selfies: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'selfies' and (storage.foldername(name))[1] = auth.uid()::text);
