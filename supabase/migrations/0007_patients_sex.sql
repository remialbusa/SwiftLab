-- ---------------------------------------------------------------------------
-- SwiftLab Portal — add sex to patients
-- ---------------------------------------------------------------------------

alter table public.patients
  add column sex text check (sex in ('male', 'female', 'other', 'prefer_not_to_say'));