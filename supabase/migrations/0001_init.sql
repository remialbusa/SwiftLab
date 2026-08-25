-- ---------------------------------------------------------------------------
-- SwiftLab Portal — schema (single migration)
-- ---------------------------------------------------------------------------
-- Tables: patients, staff_users, lab_tests, orders, order_tests,
--         schedule_slots, appointments, payments, results, magic_links,
--         audit_logs, operating_hours
-- Includes RLS policies scoped by role and row ownership.
-- ---------------------------------------------------------------------------

-- Enums ---------------------------------------------------------------
create type public.order_status as enum (
  'pre_registered',
  'payment_confirmed',
  'sample_processing',
  'results_ready',
  'cancelled'
);

create type public.staff_role as enum ('admin', 'medtech');

-- Patients ------------------------------------------------------------
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique,                  -- Supabase auth.users id (results login)
  full_name text not null,
  last_name text not null,
  dob date not null,
  email text not null,
  phone text,
  consent_marketing boolean not null default false,
  privacy_consent boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_patients_email on public.patients (lower(email));

-- Staff ---------------------------------------------------------------
create table public.staff_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role public.staff_role not null default 'medtech',
  auth_id uuid unique,                   -- Supabase auth.users id
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Lab tests (admin-managed price list) --------------------------------
create table public.lab_tests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  cash_price numeric(10,2) not null check (cash_price >= 0),
  duration_minutes int not null check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Orders --------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  status public.order_status not null default 'pre_registered',
  tracking_token_hash text not null unique,   -- sha256 of the raw token
  walk_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_patient on public.orders (patient_id);
create index idx_orders_status on public.orders (status);

-- Order <-> tests join -----------------------------------------------
create table public.order_tests (
  order_id uuid not null references public.orders(id) on delete cascade,
  lab_test_id uuid not null references public.lab_tests(id),
  primary key (order_id, lab_test_id)
);

-- Schedule slots (generated from operating hours + duration rules) ----
create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time not null,
  end_time time not null,
  capacity int not null check (capacity >= 0),
  reserved int not null default 0 check (reserved >= 0),
  unique (date, start_time, end_time)
);

create index idx_slots_date on public.schedule_slots (date);

-- Appointments (booking consumes a slot) -----------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  slot_id uuid not null references public.schedule_slots(id),
  slot_start time not null,
  slot_end time not null,
  status text not null default 'booked',       -- booked | cancelled | completed
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create index idx_appointments_slot on public.appointments (slot_id);
create index idx_appointments_order on public.appointments (order_id);

-- Payments ------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null default 'in_person',
  amount numeric(10,2) not null check (amount >= 0),
  confirmed_by uuid references public.staff_users(id),
  confirmed_at timestamptz not null default now()
);

create index idx_payments_order on public.payments (order_id);

-- Results (uploaded, encrypted PDFs served to patient) ----------------
create table public.results (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  storage_path text not null,                -- pdfs/{order_id}/{file}
  file_name text not null,
  file_size int not null check (file_size >= 0),
  uploaded_by uuid references public.staff_users(id),
  uploaded_at timestamptz not null default now(),
  released_at timestamptz
);

create index idx_results_order on public.results (order_id);

-- Magic links (tracking token + results access) -----------------------
create table public.magic_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  order_id uuid not null references public.orders(id) on delete cascade,
  purpose text not null default 'tracking',  -- tracking | results
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_magic_links_order on public.magic_links (order_id);
create index idx_magic_links_expiry on public.magic_links (expires_at);

-- Operating hours (admin config for slot generation) ------------------
create table public.operating_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  active boolean not null default true,
  unique (day_of_week)
);

-- Audit log -----------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,                  -- patient | staff | system
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_resource on public.audit_logs (resource_type, resource_id);
create index idx_audit_created on public.audit_logs (created_at);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.patients enable row level security;
alter table public.staff_users enable row level security;
alter table public.lab_tests enable row level security;
alter table public.orders enable row level security;
alter table public.order_tests enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.results enable row level security;
alter table public.magic_links enable row level security;
alter table public.operating_hours enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: is the current user staff? ---------------------------------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_users su
    where su.auth_id = auth.uid() and su.active = true
  );
$$;

-- Helper: current staff role ------------------------------------------
create or replace function public.current_staff_role() returns public.staff_role
language sql stable security definer set search_path = public as $$
  select role from public.staff_users where auth_id = auth.uid() and active = true limit 1;
$$;

-- Helper: patient rows owned by the current patient -------------------
create or replace function public.current_patient_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.patients
  where auth_id = auth.uid() or id in (
    select id from public.patients where email = (select email from auth.users where id = auth.uid())
  );
$$;

-- Patients: owner-only read -------------------------------------------
create policy "patients read own" on public.patients
  for select using (
    auth.uid() is not null and (auth_id = auth.uid())
  );
create policy "staff read patients" on public.patients
  for select using (public.is_staff());
create policy "patients update own" on public.patients
  for update using (auth_id = auth.uid());

-- Staff: admin manages, all staff read --------------------------------
create policy "staff read" on public.staff_users
  for select using (public.is_staff());
create policy "admin manage staff" on public.staff_users
  for all using (public.current_staff_role() = 'admin')
  with check (public.current_staff_role() = 'admin');

-- Lab tests: public read, staff write ---------------------------------
create policy "public read tests" on public.lab_tests
  for select using (true);
create policy "admin manage tests" on public.lab_tests
  for all using (public.current_staff_role() = 'admin')
  with check (public.current_staff_role() = 'admin');

-- Orders: patient own / staff all -------------------------------------
create policy "patient read own orders" on public.orders
  for select using (patient_id in (select public.current_patient_ids()));
create policy "staff read orders" on public.orders
  for select using (public.is_staff());
create policy "system insert orders" on public.orders
  for insert with check (true);            -- created server-side via RPC
create policy "staff update orders" on public.orders
  for update using (public.is_staff())
  with check (public.is_staff());

-- Order tests: own / staff --------------------------------------------
create policy "patient read own order_tests" on public.order_tests
  for select using (
    order_id in (select id from public.orders where patient_id in (select public.current_patient_ids()))
  );
create policy "staff read order_tests" on public.order_tests
  for select using (public.is_staff());

-- Schedule slots: public read -----------------------------------------
create policy "public read slots" on public.schedule_slots
  for select using (true);

-- Appointments: own / staff -------------------------------------------
create policy "patient read own appointments" on public.appointments
  for select using (
    order_id in (select id from public.orders where patient_id in (select public.current_patient_ids()))
  );
create policy "staff read appointments" on public.appointments
  for select using (public.is_staff());
create policy "staff update appointments" on public.appointments
  for update using (public.is_staff()) with check (public.is_staff());

-- Payments: staff only (patients see status via order) -----------------
create policy "staff read payments" on public.payments
  for select using (public.is_staff());
create policy "staff insert payments" on public.payments
  for insert with check (public.is_staff());

-- Results: patient own / staff ----------------------------------------
create policy "patient read own results" on public.results
  for select using (
    order_id in (select id from public.orders where patient_id in (select public.current_patient_ids()))
  );
create policy "staff read results" on public.results
  for select using (public.is_staff());
create policy "staff insert results" on public.results
  for insert with check (public.is_staff());

-- Magic links: staff read (patient uses token, not session) -----------
create policy "staff read magic_links" on public.magic_links
  for select using (public.is_staff());
create policy "system insert magic_links" on public.magic_links
  for insert with check (true);

-- Operating hours: staff read/write -----------------------------------
create policy "public read hours" on public.operating_hours
  for select using (true);
create policy "admin manage hours" on public.operating_hours
  for all using (public.current_staff_role() = 'admin')
  with check (public.current_staff_role() = 'admin');

-- Audit logs: insert by any authenticated, read by admin --------------
create policy "system insert audit" on public.audit_logs
  for insert with check (true);
create policy "admin read audit" on public.audit_logs
  for select using (public.current_staff_role() = 'admin');