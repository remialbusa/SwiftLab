-- ---------------------------------------------------------------------------
-- SwiftLab Portal — admin-configurable settings
-- ---------------------------------------------------------------------------
-- Key/value store for runtime configuration that admins can change without a
-- deploy: results-link TTL, tracking-link TTL, and the results-unlock rate
-- limit (max attempts + window). Values are JSONB so types are preserved.
-- ---------------------------------------------------------------------------

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

-- Admins read/write settings; staff may read (e.g. to surface link expiry).
create policy "admin manage settings" on public.settings
  for all using (public.current_staff_role() = 'admin')
  with check (public.current_staff_role() = 'admin');
create policy "staff read settings" on public.settings
  for select using (public.is_staff());

-- Seed defaults. Admin can override these via the settings UI.
insert into public.settings (key, value) values
  ('results_unlock_max_attempts', '5'::jsonb),
  ('results_unlock_window_minutes', '15'::jsonb),
  ('results_link_ttl_days', '30'::jsonb),
  ('tracking_link_ttl_days', '90'::jsonb)
on conflict (key) do nothing;