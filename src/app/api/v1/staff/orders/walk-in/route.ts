import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { getServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';
import { generateToken, hashToken, generateTrackingCode } from '@/lib/token';

const walkInSchema = z.object({
  fullName: z.string().min(2).max(120),
  lastName: z.string().min(1).max(80),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  testIds: z.array(z.string().uuid()).min(1).max(20),
});

/**
 * POST /api/v1/staff/orders/walk-in
 * Staff creates a walk-in order directly (no online tracking email required).
 * Order starts in `pre_registered`; staff will process it as normal.
 */
export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = walkInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }, { status: 400 });
  }

  const client = getServiceClient();

  // Create patient (may already exist).
  const { data: existing } = await client
    .from('patients')
    .select('id')
    .eq('email', parsed.data.email?.toLowerCase() ?? '__none__')
    .maybeSingle();

  let patientId: string;
  if (existing) {
    patientId = existing.id as string;
  } else {
    const { data: patient, error: patientErr } = await client
      .from('patients')
      .insert({
        full_name: parsed.data.fullName,
        last_name: parsed.data.lastName,
        dob: parsed.data.dob,
        sex: parsed.data.sex ?? null,
        email: parsed.data.email?.toLowerCase() ?? 'walkin@swiftlab.local',
        phone: parsed.data.phone ?? null,
        privacy_consent: true,
      })
      .select()
      .single();
    if (patientErr || !patient) {
      return NextResponse.json({ error: 'Could not create patient.' }, { status: 500 });
    }
    patientId = patient.id as string;
  }

  const tokenHash = hashToken(generateToken());
  const { data: order, error: orderErr } = await client
    .from('orders')
    .insert({
      patient_id: patientId,
      status: 'pre_registered',
      tracking_token_hash: tokenHash,
      tracking_code: generateTrackingCode(),
      walk_in: true,
    })
    .select()
    .single();
  if (orderErr || !order) {
    return NextResponse.json({ error: 'Could not create order.' }, { status: 500 });
  }

  await client.from('order_tests').insert(parsed.data.testIds.map((labTestId) => ({ order_id: order.id, lab_test_id: labTestId })));

  await writeAuditLog({
    actorType: 'staff',
    actorId: session.identity.id,
    action: 'order.walk_in_created',
    resourceType: 'order',
    resourceId: order.id,
    metadata: { tests: parsed.data.testIds },
  });

  return NextResponse.json({ ok: true, orderId: order.id }, { status: 201 });
}