# SwiftLab Portal — Manual Testing Guide

This walks a fresh environment from zero to a fully tested patient-results
flow. Follow the blockers section first, then the walkthroughs.

---

## 0. Blockers — required before anything works

### 0.1 Environment variables

The app **will not start** without a `.env.local`. Copy the template:

```bash
cp .env.example .env.local
```

Then fill in real values (see `.env.example` for where each comes from):

| Var                             | Source                                                               |
| ------------------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase dashboard → Settings → API                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API                                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase dashboard → Settings → API (server-only, never expose)      |
| `RESEND_API_KEY`                | Resend dashboard → API Keys                                          |
| `EMAIL_FROM`                    | Verified sender; `onboarding@resend.dev` works in dev                |
| `APP_URL`                       | `http://localhost:3000` in dev                                       |
| `QPDF_PATH`                     | Optional on Windows (defaults to `C:\Program Files\qpdf 12.4.0\bin`) |

### 0.2 Database — apply migrations

All schema + seed data lives in `supabase/migrations/`. Either:

**Hosted project** — link and push:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

**Local stack**:

```bash
supabase start
supabase db push
```

Migrations applied: `0001_init` (tables + RLS), `0002_functions_seed`
(functions + test/hours seed), `0003_storage` (private PDF bucket),
`0004_settings` (admin settings table).

### 0.3 Staff users — the piece that blocks /staff and /admin

**There is no migration that creates staff logins.** `getStaffIdentity()`
returns null unless a `staff_users` row exists whose `auth_id` matches a
Supabase Auth user. Until you do this, `/staff/login` returns 403 and `/admin`
redirects to login.

Run the seed script (creates the auth user + links `staff_users`):

```bash
node --import tsx scripts/seed-staff.ts admin@swiftlab.local SwiftLab#2026 admin
node --import tsx scripts/seed-staff.ts medtech@swiftlab.local SwiftLab#2026 medtech
```

Or the one-shot bootstrap (migrations + both staff users):

```bash
node --import tsx scripts/bootstrap-dev-db.ts
```

If you prefer the dashboard:

1. Supabase → Authentication → Users → **Add user** (email + password, confirm).
2. Supabase → SQL Editor:
   ```sql
   insert into public.staff_users (name, role, auth_id, active)
   values ('Admin One', 'admin', '<auth-user-id>', true);
   ```

Default dev logins (from the seed script):

- `admin@swiftlab.local` / `SwiftLab#2026` — **admin**
- `medtech@swiftlab.local` / `SwiftLab#2026` — **medtech**

> Change the password before any shared environment.

---

## 1. Smoke checks (no UI)

With `npm run dev` running:

```bash
# Public test list
curl http://localhost:3000/api/v1/lab-tests

# Slots for today (lazily generates 14 days ahead)
curl "http://localhost:3000/api/v1/schedule/slots?date=$(Get-Date -Format yyyy-MM-dd)"
```

And the PDF encryption smoke test (no Supabase needed):

```bash
node --import tsx scripts/smoke-pdf.ts
```

---

## 2. Patient flow (public)

1. **Register an order** — use the UI (`/order`) or the demo script:

   ```bash
   node --import tsx scripts/create-order-demo.ts demo.patient@example.com
   ```

   The script prints a tracking link. Note: `createOrder` **awaits the email
   send**, so if `RESEND_API_KEY` is invalid the API returns 500 _after_ the DB
   rows are written (patient/order/magic link exist, no email delivered).

2. **Track the order** — open the printed `/track/<token>` URL. You should see
   the status badge, tests, and registered time. (No appointment yet — see
   section 4.)

3. **Staff side (same order)** — see section 3, then return here when the
   status is `results_ready`.

4. **Download results** — open the results link from the results-ready email,
   enter last name + birth date, download the PDF, and open it. The PDF
   password is `{lastname}{YYYY-MM-DD}` (lowercase, no spaces), e.g.
   `patient1990-05-14`. Verify:
   - Correct password opens the file.
   - Wrong password is rejected by the PDF viewer.

---

## 3. Staff flow (MedTech)

1. Open `/staff/login`, sign in as **medtech** (`medtech@swiftlab.local`).
2. **Order queue** (`/staff/orders`) — search by name/email, filter by status.
3. **Order detail** — open an order:
   - Confirm payment (records payment, sets `payment_confirmed`).
   - Flip status through `sample_processing` → `results_ready`.
   - **Upload a PDF first** — the `results_ready` email is only sent when
     results exist. Drag a PDF onto the drop zone; it's encrypted with the
     patient's derived password and stored in the private bucket.
4. **Walk-in** (`/staff/walk-in`) — create an order without email.
5. A medtech **cannot** access `/admin/*` — the layout redirects them to
   `/staff/orders`, and the admin API returns 403. The staff nav shows only
   **Orders / Walk-in** (no Admin link).

## 3b. Admin flow

1. Sign in as **admin** (`admin@swiftlab.local`).
2. The staff layout shows an extra **Admin** link. The admin layout shows
   **Lab tests / Hours / Settings / Audit log** — configuration only (no order
   queue; order operations live under `/staff/*`).
3. Admin can still perform order operations by using the staff area (Orders /
   Walk-in appear in the staff header for admins too).

---

## 4. Booking (API-only today)

There is **no UI to pick a slot** yet — the `/order` page registers without an
appointment. To test the booking chain manually:

```bash
# Pick a date + slot
$slots = Invoke-RestMethod "http://localhost:3000/api/v1/schedule/slots?date=2026-08-27"
$slotId = $slots.slots[0].id

# Book it against an order id (from the demo script output)
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/v1/orders/<ORDER_ID>/appointment" `
  -ContentType "application/json" `
  -Body (@{ slotId = $slotId } | ConvertTo-Json)

# The tracking page then shows the appointment slot.
```

---

## 5. Admin flow

1. Sign in as **admin** (`/staff/login`).
2. `/admin/lab-tests` — add/edit/deactivate a test; verify it appears/disappears
   from the public `/order` page.
3. `/admin/operating-hours` — change hours; verify new slots appear via the
   slots endpoint for affected dates.
4. `/admin/settings` — lower `results_unlock_max_attempts` to 3, save, then on
   the results page enter the wrong last name 4× — the 4th attempt should get
   a 429 (lockout until the window passes).
5. `/admin/audit-logs` — verify entries for login, order creation, payment,
   result upload, unlock attempts, settings changes.

---

## 6. Security checks worth doing once

- **Rate limit**: wrong-password attempts → `429` + `Retry-After` after the
  configured max.
- **RLS**: signed out, `GET /api/v1/staff/orders` → 401/403; a non-admin staff
  hitting `/api/v1/admin/settings` → 403.
- **Magic links**: after the tracking link is used, it stays valid (by design —
  `used_at` is not set on view); revoking requires the dashboard.
- **PDF bucket**: `patient-pdfs` is private; files are only reachable via
  signed URLs minted server-side after the unlock check.

---

## Known gaps (not blockers)

- No UI for booking an appointment (API only — section 4).
- The rate limiter is in-memory (resets on server restart; not shared across
  multiple instances).
- Audit log pages reload server-side on filter/pagination (no client fetch).
