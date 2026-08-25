import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';
import { generateSlotsForRange } from '@/lib/slots';

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

/** Number of days ahead to lazily generate slots for when a date is requested. */
const GENERATE_AHEAD_DAYS = 14;

/**
 * GET /api/v1/schedule/slots?date=YYYY-MM-DD
 * Lazily generates slots for the requested date (and a look-ahead window) if
 * they don't exist yet, then returns slots with remaining capacity.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ date: url.searchParams.get('date') });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid date.' }, { status: 400 });
  }

  const client = getServiceClient();

  // Lazy generation: ensure slots exist for the requested date and a small
  // look-ahead window so the booking UI always has options.
  const requested = new Date(`${parsed.data.date}T00:00:00Z`);
  const horizon = new Date(requested);
  horizon.setUTCDate(horizon.getUTCDate() + GENERATE_AHEAD_DAYS);
  await generateSlotsForRange(requested, horizon);

  const { data, error } = await client
    .from('schedule_slots')
    .select('id, date, start_time, end_time, capacity, reserved')
    .eq('date', parsed.data.date)
    .gte('capacity', 1)
    .order('start_time');

  if (error) {
    return NextResponse.json({ error: 'Could not load slots.' }, { status: 500 });
  }

  const slots = (data ?? []).map((row) => ({
    id: row.id,
    start: row.start_time,
    end: row.end_time,
    remaining: (row.capacity as number) - (row.reserved as number),
  }));

  return NextResponse.json({ slots });
}