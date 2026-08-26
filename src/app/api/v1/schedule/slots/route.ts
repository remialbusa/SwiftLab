import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';
import { generateSlotsForRange } from '@/lib/slots';

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  /** Optional: when set, returns availability for the whole range [date, rangeEnd]. */
  rangeEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'rangeEnd must be YYYY-MM-DD')
    .nullish(),
});

/** Number of days ahead to lazily generate slots for when a date is requested. */
const GENERATE_AHEAD_DAYS = 14;

/**
 * GET /api/v1/schedule/slots?date=YYYY-MM-DD[&rangeEnd=YYYY-MM-DD]
 * Lazily generates slots for the requested date (and a look-ahead window) if
 * they don't exist yet, then returns slots with remaining capacity.
 *
 * When `rangeEnd` is provided, returns `availability` grouped by date (each
 * date's available slot count) plus the `slots` for the requested date — so
 * a calendar can render availability at a glance with a single request.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    date: url.searchParams.get('date'),
    rangeEnd: url.searchParams.get('rangeEnd'),
  });
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

  // Optional range availability: count available slots per date in [date, rangeEnd].
  if (parsed.data.rangeEnd) {
    const { data: rangeData, error: rangeErr } = await client
      .from('schedule_slots')
      .select('date, capacity, reserved')
      .gte('date', parsed.data.date)
      .lte('date', parsed.data.rangeEnd)
      .gte('capacity', 1);

    if (!rangeErr) {
      const availability: Record<string, number> = {};
      for (const row of rangeData ?? []) {
        const remaining = (row.capacity as number) - (row.reserved as number);
        if (remaining > 0) {
          availability[row.date as string] = (availability[row.date as string] ?? 0) + 1;
        }
      }
      return NextResponse.json({ slots, availability });
    }
  }

  return NextResponse.json({ slots });
}