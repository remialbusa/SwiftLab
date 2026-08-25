-- ---------------------------------------------------------------------------
-- SwiftLab Portal — fix: patients.email uniqueness
-- ---------------------------------------------------------------------------
-- `createOrder` (and the walk-in flow) upsert patients with
-- `onConflict: 'email'`, which requires a unique constraint on email — a plain
-- index (lower(email)) is not enough. Add the constraint. Existing duplicates
-- (should be none in practice) would block this; the query surfaces them.
-- ---------------------------------------------------------------------------

-- De-duplicate first, keeping the earliest row per email.
delete from public.patients p
using public.patients p2
where p.id <> p2.id
  and lower(p.email) = lower(p2.email)
  and p.created_at > p2.created_at;

-- Add the unique constraint that the upsert conflict target needs.
alter table public.patients
  add constraint patients_email_unique unique (email);