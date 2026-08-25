/**
 * Guard helper for route handlers: resolves the current staff session and
 * returns the staff identity, or null when unauthenticated / not staff.
 */

import { createRequestClient } from '@/lib/supabase/request';
import { getStaffIdentity, type StaffIdentity } from '@/lib/staffAuth';

export interface StaffSession {
  identity: StaffIdentity;
}

/**
 * Resolve the current staff session. Returns null when there is no valid
 * authenticated staff user. Use in API routes that require staff access.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const client = await createRequestClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const identity = await getStaffIdentity(user.id);
  if (!identity) return null;
  return { identity };
}