import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { isAdmin } from '@/lib/staffAuth';
import { getServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

const paramsSchema = z.object({ testId: z.string().uuid() });
const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  code: z.string().min(1).max(20).optional(),
  cashPrice: z.number().nonnegative().optional(),
  durationMinutes: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

/**
 * PATCH /api/v1/admin/lab-tests/:testId — update a lab test (admin only).
 * DELETE /api/v1/admin/lab-tests/:testId — soft-delete (deactivate) a test.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ testId: string }> }) {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { testId } = paramsSchema.parse(await params);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid test.' }, { status: 400 });
  }

  const client = getServiceClient();
  const { data, error } = await client
    .from('lab_tests')
    .update({
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.code !== undefined && { code: parsed.data.code }),
      ...(parsed.data.cashPrice !== undefined && { cash_price: parsed.data.cashPrice }),
      ...(parsed.data.durationMinutes !== undefined && { duration_minutes: parsed.data.durationMinutes }),
      ...(parsed.data.active !== undefined && { active: parsed.data.active }),
    })
    .eq('id', testId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Could not update test.' }, { status: 404 });
  }

  await writeAuditLog({
    actorType: 'staff',
    actorId: session.identity.id,
    action: 'lab_tests.updated',
    resourceType: 'lab_test',
    resourceId: testId,
    metadata: parsed.data,
  });

  return NextResponse.json({ test: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ testId: string }> }) {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { testId } = paramsSchema.parse(await params);
  const client = getServiceClient();

  // Soft-delete: deactivate so existing orders keep their test reference.
  const { data, error } = await client
    .from('lab_tests')
    .update({ active: false })
    .eq('id', testId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Could not deactivate test.' }, { status: 404 });
  }

  await writeAuditLog({
    actorType: 'staff',
    actorId: session.identity.id,
    action: 'lab_tests.deactivated',
    resourceType: 'lab_test',
    resourceId: testId,
  });

  return NextResponse.json({ ok: true });
}