/**
 * Dev bootstrap: create a Supabase Auth user and link it to a staff_users row.
 *
 * Run:
 *   node --import tsx scripts/seed-staff.ts [email] [password] [role]
 *
 * Defaults:
 *   email    admin@swiftlab.local
 *   password SwiftLab#2026 (dev only — change before any real use)
 *   role     admin
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to be set in the
 * environment (see .env.local / .env.example). Server-only; uses the service
 * role to create the auth user.
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Load .env.local so the script works without manually exporting vars.
// Simple parser: KEY=VALUE lines, ignoring comments/quotes.
function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const eq = line.indexOf('=');
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
loadEnvFile(join(process.cwd(), '.env.local'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message: string): never {
  console.error(`[seed-staff] ${message}`);
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then re-run.');
  process.exit(1);
}

if (!url) fail('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL is not set.');
if (!serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY is not set.');

const email = process.argv[2] ?? 'admin@swiftlab.local';
const password = process.argv[3] ?? 'SwiftLab#2026';
const role = (process.argv[4] ?? 'admin') as 'admin' | 'medtech';
if (role !== 'admin' && role !== 'medtech') fail(`Invalid role "${role}". Use admin or medtech.`);

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main(): Promise<void> {
  // 1. Create (or fetch) the auth user.
  let authUserId: string;
  const { data: existing, error: listError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) fail(`Could not list users: ${listError.message}`);

  const match = existing?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (match) {
    authUserId = match.id;
    console.log(`[seed-staff] Auth user already exists: ${email} (${authUserId})`);
  } else {
    const { data: created, error: createError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) fail(`Could not create auth user: ${createError.message}`);
    authUserId = created.user.id;
    console.log(`[seed-staff] Created auth user: ${email} (${authUserId})`);
  }

  // 2. Link the staff_users row.
  const { data: existingStaff, error: staffError } = await client
    .from('staff_users')
    .select('id, auth_id, role')
    .eq('auth_id', authUserId)
    .maybeSingle();
  if (staffError) fail(`Could not check staff_users: ${staffError.message}`);

  if (existingStaff) {
    console.log(`[seed-staff] staff_users row already exists for ${email} (role=${existingStaff.role})`);
    return;
  }

  const { data: row, error: insertError } = await client
    .from('staff_users')
    .insert({ name: email.split('@')[0], role, auth_id: authUserId, active: true })
    .select()
    .single();
  if (insertError) fail(`Could not insert staff_users row: ${insertError.message}`);
  console.log(`[seed-staff] Linked staff_users row: ${row.id} (role=${row.role})`);
}

main().catch((err) => {
  console.error('[seed-staff] Failed:', err);
  process.exit(1);
});
