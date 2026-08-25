import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

const paramsSchema = z.object({ orderId: z.string().uuid() });
const bodySchema = z.object({ slotId: z.string().uuid() });

/**
 * POST /api/v1/orders/:orderId/appointment
 * Books a slot for an order. Concurrency-safe via the `book_slot` RPC
 * (row lock on the slot; returns false when the slot is full).
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = paramsSchema.parse(await params);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid slot.' }, { status: 400 });
  }

  const client = getServiceClient();
  const { data: booked, error } = await client.rpc('book_slot', {
    p_order_id: orderId,
    p_slot_id: parsed.data.slotId,
  });

  if (error) {
    return NextResponse.json({ error: 'Could not book slot.' }, { status: 500 });
  }
  if (!booked) {
    return NextResponse.json({ error: 'Slot is no longer available.' }, { status: 409 });
  }

  await writeAuditLog({
    actorType: 'patient',
    action: 'appointment.booked',
    resourceType: 'order',
    resourceId: orderId,
    metadata: { slotId: parsed.data.slotId },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

/**
 * DELETE /api/v1/orders/:orderId/appointment
 * Cancels the order's appointment and frees the slot capacity.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = paramsSchema.parse(await params);
  const client = getServiceClient();

  const { data: appointment } = await client
    .from('appointments')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'booked')
    .maybeSingle();

  if (!appointment) {
    return NextResponse.json({ error: 'No active appointment to cancel.' }, { status: 404 });
  }

  const { data: cancelled, error } = await client.rpc('cancel_appointment', {
    p_appointment_id: appointment.id,
  });
  if (error || !cancelled) {
    return NextResponse.json({ error: 'Could not cancel appointment.' }, { status: 500 });
  }

  await writeAuditLog({
    actorType: 'patient',
    action: 'appointment.cancelled',
    resourceType: 'order',
    resourceId: orderId,
  });

  return NextResponse.json({ ok: true });
}