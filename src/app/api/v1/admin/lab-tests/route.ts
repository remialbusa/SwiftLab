import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { isAdmin } from '@/lib/staffAuth';
import { getServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

const testSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(1).max(20),
  cashPrice: z.number().nonnegative(),
  durationMinutes: z.number().int().positive(),
  active: z.boolean().default(true),
});

/**
 * GET /api/v1/admin/lab-tests — list all tests (admin only).
 * POST /api/v1/admin/lab-tests — create a test.
 */
export async function GET() {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const client = getServiceClient();
  const { data, error } = await client.from('lab_tests').select('id, name, code, cash_price, duration_minutes, active').order('name');
  if (error) {
    return NextResponse.json({ error: 'Could not load tests.' }, { status: 500 });
  }
  return NextResponse.json({ tests: data ?? [] });
}

export async function POST(request: Request) {
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
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid test.' }, { status: 400 });
  }

  const client = getServiceClient();
  const { data, error } = await client
    .from('lab_tests')
    .insert({
      name: parsed.data.name,
      code: parsed.data.code,
      cash_price: parsed.data.cashPrice,
      duration_minutes: parsed.data.durationMinutes,
      active: parsed.data.active,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not create test (code may already exist).' }, { status: 409 });
  }

  await writeAuditLog({
    actorType: 'staff',
    actorId: session.identity.id,
    action: 'lab_tests.created',
    resourceType: 'lab_test',
    resourceId: data.id,
  });

  return NextResponse.json({ test: data }, { status: 201 });
}