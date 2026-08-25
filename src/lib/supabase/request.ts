/**
 * Server Supabase client that binds to the request's cookies — used in Route
 * Handlers / Server Components to read the current staff session.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getClientEnv } from '@/lib/config';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client bound to the incoming request cookies.
 * Call this inside a route handler / server component (not cached at module
 * scope — cookies() is request-scoped).
 */
export async function createRequestClient(): Promise<SupabaseClient> {
  const env = getClientEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — safe to ignore when middleware
          // is refreshing sessions.
        }
      },
    },
  });
}