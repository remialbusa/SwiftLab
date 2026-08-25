import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRequestClient } from '@/lib/supabase/request';
import { getStaffIdentity } from '@/lib/staffAuth';
import { writeAuditLog } from '@/lib/audit';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * POST /api/v1/staff/login
 * Signs in a staff user via Supabase Auth. Verifies the account maps to an
 * active staff_users row before returning success (so random auth users can't
 * log in). Sets the auth session cookie.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 400 });
  }

  const client = await createRequestClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    await writeAuditLog({
      actorType: 'staff',
      action: 'login.failed',
      resourceType: 'staff',
      metadata: { email: parsed.data.email, reason: error?.message ?? 'unknown' },
    });
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const identity = await getStaffIdentity(data.user.id);
  // Only staff_users (admin/medtech) may use this portal; disable otherwise.
  if (!identity) {
    await client.auth.signOut();
    await writeAuditLog({
      actorType: 'staff',
      actorId: data.user.id,
      action: 'login.denied.not_staff',
      resourceType: 'staff',
      metadata: { email: parsed.data.email },
    });
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  await writeAuditLog({
    actorType: 'staff',
    actorId: identity.id,
    action: 'login.success',
    resourceType: 'staff',
    metadata: { role: identity.role },
  });

  return NextResponse.json({ ok: true, role: identity.role, name: identity.name });
}