/**
 * Slot generation helpers. Builds `schedule_slots` rows from operating hours
 * divided into fixed intervals, and computes remaining capacity for a booking.
 */

import { getServiceClient } from '@/lib/supabase/server';

export interface SlotWindow {
  date: string;
  start: string; // HH:mm
  end: string; // HH:mm
}

const SLOT_MINUTES = 15;

/** Expand operating hours for a given date into slot windows. */
export function buildSlotWindows(openTime: string, closeTime: string, date: string): SlotWindow[] {
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  const startMin = oh * 60 + om;
  const endMin = ch * 60 + cm;
  const windows: SlotWindow[] = [];
  for (let m = startMin; m + SLOT_MINUTES <= endMin; m += SLOT_MINUTES) {
    const start = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const e = m + SLOT_MINUTES;
    const end = `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
    windows.push({ date, start, end });
  }
  return windows;
}

/** Convenience: generate slots for every active operating-hours day in a range. */
export async function generateSlotsForRange(startDate: Date, endDate: Date): Promise<void> {
  const client = getServiceClient();
  const { data: hours } = await client.from('operating_hours').select('day_of_week, open_time, close_time').eq('active', true);
  if (!hours) return;

  const rows = hours.map((h) => ({ dow: h.day_of_week as number, open: h.open_time as string, close: h.close_time as string }));
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);

  const inserts: { date: string; start_time: string; end_time: string; capacity: number }[] = [];
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    const rule = rows.find((r) => r.dow === dow);
    if (rule) {
      for (const w of buildSlotWindows(rule.open, rule.close, toIso(cursor))) {
        inserts.push({ date: w.date, start_time: w.start, end_time: w.end, capacity: 2 });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (inserts.length > 0) {
    await client.from('schedule_slots').upsert(inserts, { onConflict: 'date,start_time,end_time' });
  }
}