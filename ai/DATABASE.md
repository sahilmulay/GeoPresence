# Database (Supabase / PostgreSQL)

Source of truth: [`supabase/schema.sql`](../supabase/schema.sql). Demo data: [`supabase/seed.sql`](../supabase/seed.sql).

## Tables

| Table | Columns |
| --- | --- |
| `supervisors` | id (= auth user id), name, email, ward_no, created_at |
| `employees` | id (= auth user id), name, email, ward_no, supervisor_id → supervisors, created_at |
| `attendance` | id, employee_id → employees, photo_url, latitude, longitude, timestamp, check_type (`CHECKIN`/`CHECKOUT`), status (`PRESENT`/`FLAGGED`), created_at |
| `tasks` | id, title, description, assigned_by → supervisors, assigned_to → employees, ward_no, status (`PENDING`/`IN_PROGRESS`/`COMPLETED`), created_at |

## Trigger
`on_auth_user_created` → `handle_new_user()` (security definer) creates the profile row from sign-up metadata and links supervisor ↔ employees by ward.

## Row Level Security (summary)
- Supervisor reads employees/attendance/tasks of **their ward** (`my_ward()`); creates/deletes tasks for that ward.
- Employee reads self, own supervisor, own attendance and own tasks; inserts only own attendance; updates status of own tasks.
- Helper functions `my_ward()`, `my_supervisor_id()`, `ward_of_employee()` are `SECURITY DEFINER` to avoid policy recursion.
- Known simplification: employees can update any column of their own tasks (UI only changes status).

## Storage
Public bucket `selfies`; authenticated users may upload only into a folder named with their own user id.

## Seed (Ward 5)
Supervisor Rajesh Patil + employees Sahil Mulay, Amit Jadhav, Rohit Shinde, Priya Kulkarni (password `Demo@123`, emails `…@geopresence.demo`). Attendance for today (Sahil present, Amit checked out, Priya present+flagged, Rohit absent) and the previous 3 days; 6 tasks in all statuses. The seed re-dates itself to "today" on each run (re-run before a demo). Seeded attendance has no photo (UI shows initials); real check-ins show selfies.
Demo-mode (`localApi.js`) mirrors this data and re-dates it automatically each day.
