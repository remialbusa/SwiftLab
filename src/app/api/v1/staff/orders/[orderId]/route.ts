import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { getServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';
import { issueResultsLink } from '@/lib/orders';

const paramsSchema = z.object({ orderId: z.string().uuid() });
const bodySchema = z.object({
  status: z.enum(['pre_registered', 'payment_confirmed', 'sample_processing', 'results_ready', 'cancelled']),
});

/**
 * PATCH /api/v1/staff/orders/:orderId
 * Staff updates order status. Transition to `results_ready` triggers the
 * results-ready email to the patient (if results are present).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { orderId } = paramsSchema.parse(await params);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid status.' }, { status: 400 });
  }

  const client = getServiceClient();
  const { data: order } = await client
    .from('orders')
    .select('id, status, patient_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const { error } = await client.from('orders').update({ status: parsed.data.status }).eq('id', orderId);
  if (error) {
    return NextResponse.json({ error: 'Could not update order.' }, { status: 500 });
  }

  await writeAuditLog({
    actorType: 'staff',
    actorId: session.identity.id,
    action: 'order.status_changed',
    resourceType: 'order',
    resourceId: orderId,
    metadata: { from: order.status, to: parsed.data.status },
  });

  // Transition to results_ready: email the patient their download link.
  if (parsed.data.status === 'results_ready') {
    const { data: patient } = await client
      .from('patients')
      .select('full_name, email')
      .eq('id', order.patient_id)
      .maybeSingle();
    const { data: results } = await client.from('results').select('id').eq('order_id', orderId);
    if (patient && results && results.length > 0) {
      await issueResultsLink(orderId, patient.email as string, patient.full_name as string);
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/v1/staff/orders/:orderId
 * Staff views a single order with patient details, tests, payment, results.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { orderId } = paramsSchema.parse(await params);
  const client = getServiceClient();

  const { data: order } = await client
    .from('orders')
    .select('id, status, created_at, walk_in, patients(full_name, last_name, dob, sex, email, phone), order_tests(lab_tests(id, name, code, cash_price))')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const { data: payments } = await client.from('payments').select('method, amount, confirmed_at').eq('order_id', orderId);
  const { data: results } = await client.from('results').select('id, file_name, file_size, uploaded_at').eq('order_id', orderId);
  const { data: appointment } = await client.from('appointments').select('slot_start, slot_end, status').eq('order_id', orderId).maybeSingle();

  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      createdAt: order.created_at,
      walkIn: order.walk_in,
      patient: order.patients,
      tests: (order.order_tests as { lab_tests?: unknown }[] ?? []).map((t) => t.lab_tests),
      payments: payments ?? [],
      results: results ?? [],
      appointment: appointment ?? null,
    },
  });
}