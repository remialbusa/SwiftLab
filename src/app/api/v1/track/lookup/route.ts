import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrderByTrackingCode, type OrderSummary } from '@/lib/orders';

const bodySchema = z.object({
  code: z.string().min(1).max(20),
});

/**
 * POST /api/v1/track/lookup
 * Resolve a human-friendly tracking code (SL-XXXXXX) to an order summary.
 * Used by the public track-entry page.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid tracking code.' }, { status: 400 });
  }

  const summary = await getOrderByTrackingCode(parsed.data.code);
  if (!summary) {
    return NextResponse.json({ error: 'No order found with that tracking code.' }, { status: 404 });
  }

  return NextResponse.json({ summary } satisfies { summary: OrderSummary });
}