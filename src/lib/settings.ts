/**
 * Admin-configurable application settings.
 *
 * Stored as a key/value JSONB table so admins can tune security-relevant
 * values (results-link TTL, tracking-link TTL, unlock rate limit) without a
 * deploy. Reads fall back to sane defaults when a key is missing.
 */

import { getServiceClient } from '@/lib/supabase/server';

export interface AppSettings {
  /** Max unlock attempts per IP within the window before a lockout. */
  resultsUnlockMaxAttempts: number;
  /** Rate-limit window (minutes) for results unlock attempts. */
  resultsUnlockWindowMinutes: number;
  /** How long a results magic link stays valid (days). */
  resultsLinkTtlDays: number;
  /** How long a tracking magic link stays valid (days). */
  trackingLinkTtlDays: number;
}

const DEFAULTS: AppSettings = {
  resultsUnlockMaxAttempts: 5,
  resultsUnlockWindowMinutes: 15,
  resultsLinkTtlDays: 30,
  trackingLinkTtlDays: 90,
};

const KEY_MAP: Record<keyof AppSettings, string> = {
  resultsUnlockMaxAttempts: 'results_unlock_max_attempts',
  resultsUnlockWindowMinutes: 'results_unlock_window_minutes',
  resultsLinkTtlDays: 'results_link_ttl_days',
  trackingLinkTtlDays: 'tracking_link_ttl_days',
};

/** Load all settings, merging DB values over defaults. */
export async function getSettings(): Promise<AppSettings> {
  const client = getServiceClient();
  const { data } = await client.from('settings').select('key, value');
  const stored: Record<string, unknown> = {};
  for (const row of data ?? []) {
    stored[row.key as string] = row.value;
  }

  const result: AppSettings = { ...DEFAULTS };
  for (const key of Object.keys(KEY_MAP) as (keyof AppSettings)[]) {
    const raw = stored[KEY_MAP[key]];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[key] = raw;
    }
  }
  return result;
}

/** Persist a partial set of settings. Returns the merged result. */
export async function updateSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const client = getServiceClient();
  const rows = (Object.keys(patch) as (keyof AppSettings)[])
    .filter((key) => patch[key] !== undefined)
    .map((key) => ({
      key: KEY_MAP[key],
      value: patch[key] as number,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length > 0) {
    await client.from('settings').upsert(rows, { onConflict: 'key' });
  }
  return getSettings();
}