/**
 * Guard helper for route handlers: resolves the current staff session and
 * returns the staff identity, or null when unauthenticated / not staff.
 */

import { createRequestClient } from '@/lib/supabase/request';
import { getStaffIdentity, type StaffIdentity } from '@/lib/staffAuth';
import { tryGetClientEnv } from '@/lib/config';

export interface StaffSession {
  identity: StaffIdentity;
}

/**
 * Resolve the current staff session. Returns null when there is no valid
 * authenticated staff user. Use in API routes that require staff access.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  // Layouts run at build/collect time, where NEXT_PUBLIC_* can be absent
  // (e.g. Vercel preview without the vars). Degrade to signed-out so the
  // env throw can't break the build; callers redirect to login.
  if (!tryGetClientEnv()) return null;
  const client = await createRequestClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const identity = await getStaffIdentity(user.id);
  if (!identity) return null;
  return { identity };
}