import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { isAdmin } from '@/lib/staffAuth';
import { getServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

const hoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  active: z.boolean().default(true),
});

/**
 * GET /api/v1/admin/operating-hours — list hours (admin only).
 * PUT /api/v1/admin/operating-hours — upsert the full week's hours.
 */
export async function GET() {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const client = getServiceClient();
  const { data, error } = await client
    .from('operating_hours')
    .select('id, day_of_week, open_time, close_time, active')
    .order('day_of_week');
  if (error) {
    return NextResponse.json({ error: 'Could not load hours.' }, { status: 500 });
  }
  return NextResponse.json({ hours: data ?? [] });
}

export async function PUT(request: Request) {
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
  const parsed = z.object({ hours: z.array(hoursSchema).max(7) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid hours.' }, { status: 400 });
  }

  const client = getServiceClient();
  const rows = parsed.data.hours.map((h) => ({
    day_of_week: h.dayOfWeek,
    open_time: h.openTime,
    close_time: h.closeTime,
    active: h.active,
  }));

  const { error } = await client.from('operating_hours').upsert(rows, { onConflict: 'day_of_week' });
  if (error) {
    return NextResponse.json({ error: 'Could not save hours.' }, { status: 500 });
  }

  await writeAuditLog({
    actorType: 'staff',
    actorId: session.identity.id,
    action: 'operating_hours.updated',
    resourceType: 'operating_hours',
    metadata: { count: rows.length },
  });

  return NextResponse.json({ ok: true });
}