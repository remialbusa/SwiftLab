import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { isAdmin } from '@/lib/staffAuth';
import { getSettings, updateSettings } from '@/lib/settings';
import { writeAuditLog } from '@/lib/audit';

const updateSchema = z.object({
  resultsUnlockMaxAttempts: z.number().int().min(1).max(100).optional(),
  resultsUnlockWindowMinutes: z.number().int().min(1).max(1440).optional(),
  resultsLinkTtlDays: z.number().int().min(1).max(365).optional(),
  trackingLinkTtlDays: z.number().int().min(1).max(365).optional(),
});

/**
 * GET /api/v1/admin/settings — current settings (admin only).
 * PATCH /api/v1/admin/settings — update one or more settings.
 */
export async function GET() {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  return NextResponse.json({ settings: await getSettings() });
}

export async function PATCH(request: Request) {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings.' }, { status: 400 });
  }

  const settings = await updateSettings(parsed.data);

  await writeAuditLog({
    actorType: 'staff',
    actorId: session.identity.id,
    action: 'settings.updated',
    resourceType: 'settings',
    metadata: parsed.data,
  });

  return NextResponse.json({ settings });
}