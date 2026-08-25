/**
 * Client-side Supabase browser client for use in client components.
 * Uses the anon key; RLS enforces row-level access.
 */

'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getClientEnv } from '@/lib/config';
import type { SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** Browser Supabase client (anon key). Call from client components only. */
export function getBrowserClient(): SupabaseClient {
  if (cached) return cached;
  const env = getClientEnv();
  cached = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return cached;
}