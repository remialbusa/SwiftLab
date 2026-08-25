/**
 * Pre-generate schedule slots for the next N days.
 *
 * Run manually or on a schedule (cron) to warm the slots table ahead of time:
 *   node --import tsx scripts/generate-slots.ts [days]
 *
 * Defaults to 30 days. Requires the same env vars as the app (Supabase keys).
 */

import { generateSlotsForRange } from '../src/lib/slots';

async function main(): Promise<void> {
  const days = Number(process.argv[2] ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    console.error('Usage: node --import tsx scripts/generate-slots.ts [days 1-90]');
    process.exit(1);
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + days);

  console.log(`Generating slots from ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}…`);
  await generateSlotsForRange(start, end);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Slot generation failed:', err);
  process.exit(1);
});