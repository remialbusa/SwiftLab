import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrder } from '@/lib/orders';
import { requestOrigin } from '@/lib/requestOrigin';

const createOrderSchema = z.object({
  fullName: z.string().min(2).max(120),
  lastName: z.string().min(1).max(80),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD'),
  sex: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  testIds: z.array(z.string().uuid()).min(1).max(20),
  privacyConsent: z.boolean(),
  slotId: z.string().uuid().optional(),
});

/**
 * POST /api/v1/orders
 * Registers a new order and emails the tracking link.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }, { status: 400 });
  }

  const result = await createOrder({ ...parsed.data, origin: requestOrigin(request) });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json(
    {
      trackingToken: result.trackingToken,
      trackingCode: result.trackingCode,
      orderId: result.orderId,
      passwordHint: {
        // Client may show the derivation rule, not the secret itself.
        format: 'lastnameMMDDYYYY',
      },
      ok: true,
    },
    { status: 201 },
  );
}