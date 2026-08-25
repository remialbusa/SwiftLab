-- ---------------------------------------------------------------------------
-- SwiftLab Portal — storage: private bucket for encrypted patient PDFs
-- ---------------------------------------------------------------------------
-- Bucket is private; access is mediated by signed URLs issued server-side
-- after validating the patient's magic link / staff session.

insert into storage.buckets (id, name, public)
values ('patient-pdfs', 'patient-pdfs', false)
on conflict (id) do nothing;

-- Staff (medtech/admin) can upload files into the private bucket.
create policy "staff upload patient pdfs"
  on storage.objects for insert
  with check (
    bucket_id = 'patient-pdfs'
    and public.is_staff()
  );

-- Staff can read metadata of files they manage.
create policy "staff read patient pdfs"
  on storage.objects for select
  using (
    bucket_id = 'patient-pdfs'
    and public.is_staff()
  );

-- No public read/write; patient access flows through signed URLs only.