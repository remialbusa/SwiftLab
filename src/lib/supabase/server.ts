/**
 * Server-side Supabase client factory.
 * Uses the service-role key for admin operations (creating magic links,
 * issuing signed URLs, staff auth). Never expose this client to the browser.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/config';

let cached: SupabaseClient | null = null;

/** Admin/client with service-role privileges. Server-only. */
export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  const env = getServerEnv();
  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}