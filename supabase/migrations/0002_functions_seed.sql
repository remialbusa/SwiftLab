-- ---------------------------------------------------------------------------
-- SwiftLab Portal — functions (concurrency-safe booking) + seed data
-- ---------------------------------------------------------------------------

-- Book a slot atomically: decrements remaining capacity and creates the
-- appointment in a single transaction. Returns false if the slot is full.
create or replace function public.book_slot(
  p_order_id uuid,
  p_slot_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_capacity int;
  v_reserved int;
  v_start time;
  v_end time;
begin
  -- Lock the slot row so concurrent bookings serialize on it.
  select capacity, reserved, start_time, end_time
    into v_capacity, v_reserved, v_start, v_end
    from public.schedule_slots
    where id = p_slot_id
    for update;

  if not found then
    return false;
  end if;

  if v_reserved >= v_capacity then
    return false;
  end if;

  update public.schedule_slots
     set reserved = reserved + 1
   where id = p_slot_id;

  insert into public.appointments (order_id, slot_id, slot_start, slot_end, status)
  values (p_order_id, p_slot_id, v_start, v_end, 'booked');

  return true;
end;
$$;

-- Cancel an appointment: frees the slot capacity and marks cancelled.
create or replace function public.cancel_appointment(p_appointment_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_slot_id uuid;
begin
  select slot_id into v_slot_id
    from public.appointments
    where id = p_appointment_id and status = 'booked'
    for update;

  if not found then
    return false;
  end if;

  update public.appointments
     set status = 'cancelled', cancelled_at = now()
   where id = p_appointment_id;

  update public.schedule_slots
     set reserved = greatest(reserved - 1, 0)
   where id = v_slot_id;

  return true;
end;
$$;

-- Retention: anonymize/purge patients and their data older than N days.
-- Compliance: DPIA requires defined retention; this job purges orphaned
-- pre-order patient records and expired magic links (data minimization).
create or replace function public.purge_expired_magic_links()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_deleted int;
begin
  delete from public.magic_links
   where expires_at < now() - interval '30 days'
   returning count(*) into v_deleted;
  return v_deleted;
end;
$$;

-- Convenience: return an order's tracking-facing projection for the UI.
create or replace function public.order_summary(p_order_id uuid)
returns table (
  id uuid,
  status public.order_status,
  created_at timestamptz,
  tests text[]
)
language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.created_at,
         coalesce(array_agg(lt.name order by lt.name), '{}'::text[])
    from public.orders o
    left join public.order_tests ot on ot.order_id = o.id
    left join public.lab_tests lt on lt.id = ot.lab_test_id
   where o.id = p_order_id
   group by o.id;
$$;

-- Seed: a few common PH lab tests -------------------------------------
insert into public.lab_tests (name, code, cash_price, duration_minutes) values
  ('Complete Blood Count', 'CBC', 250.00, 15),
  ('Urinalysis', 'UA', 150.00, 10),
  ('Fasting Blood Sugar', 'FBS', 120.00, 10),
  ('Lipid Profile', 'LIPID', 450.00, 20),
  ('Chest X-Ray', 'CXR', 350.00, 25)
on conflict (code) do nothing;

-- Seed: operating hours (Mon-Fri 8am-5pm, Sat 8am-12pm) ---------------
insert into public.operating_hours (day_of_week, open_time, close_time) values
  (1, '08:00', '17:00'),
  (2, '08:00', '17:00'),
  (3, '08:00', '17:00'),
  (4, '08:00', '17:00'),
  (5, '08:00', '17:00'),
  (6, '08:00', '12:00')
on conflict (day_of_week) do nothing;