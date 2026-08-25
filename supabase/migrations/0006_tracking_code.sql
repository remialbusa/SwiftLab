-- ---------------------------------------------------------------------------
-- SwiftLab Portal — add human-friendly tracking code to orders
-- ---------------------------------------------------------------------------
-- Patients track an order with a short code (e.g. SL-7K2F9Q) instead of the
-- full URL token. The code is unique, uppercase, and generated server-side;
-- the raw token link still works as a fallback.
-- ---------------------------------------------------------------------------

alter table public.orders
  add column tracking_code text;

create unique index idx_orders_tracking_code on public.orders (tracking_code)
  where tracking_code is not null;