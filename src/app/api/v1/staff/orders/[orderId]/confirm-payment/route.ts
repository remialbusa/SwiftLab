import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { getServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

const paramsSchema = z.object({ orderId: z.string().uuid() });
const bodySchema = z.object({
  method: z.string().max(30).default('in_person'),
  amount: z.number().positive(),
});

/**
 * POST /api/v1/staff/orders/:orderId/confirm-payment
 * Records a payment and flips the order to `payment_confirmed`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payment.' }, { status: 400 });
  }

  const client = getServiceClient();
  const { data: order } = await client
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const { error: paymentErr } = await client.from('payments').insert({
    order_id: orderId,
    method: parsed.data.method,
    amount: parsed.data.amount,
    confirmed_by: session.identity.id,
  });
  if (paymentErr) {
    return NextResponse.json({ error: 'Could not record payment.' }, { status: 500 });
  }

  const { error: updateErr } = await client.from('orders').update({ status: 'payment_confirmed' }).eq('id', orderId);
  if (updateErr) {
    return NextResponse.json({ error: 'Could not update order.' }, { status: 500 });
  }

  await writeAuditLog({
    actorType: 'staff',
    actorId: session.identity.id,
    action: 'payment.confirmed',
    resourceType: 'order',
    resourceId: orderId,
    metadata: { method: parsed.data.method, amount: parsed.data.amount },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}