/**
 * Staff authorization helpers.
 *
 * Supabase Auth handles the session; this module ensures the authenticated
 * user is an active staff member and returns their role. Server-only.
 */

import { getServiceClient } from '@/lib/supabase/server';

export type StaffRole = 'admin' | 'medtech';

export interface StaffIdentity {
  id: string;
  name: string;
  role: StaffRole;
}

/**
 * Resolve a Supabase auth user id to a staff identity, or null when the user
 * is not an active staff member.
 */
export async function getStaffIdentity(authUserId: string): Promise<StaffIdentity | null> {
  const client = getServiceClient();
  const { data } = await client
    .from('staff_users')
    .select('id, name, role')
    .eq('auth_id', authUserId)
    .eq('active', true)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, name: data.name as string, role: data.role as StaffRole };
}

/** Resolve a staff identity from either the staff row id or the auth user id. */
export async function getStaffIdentityByAnyId(
  id: string,
): Promise<StaffIdentity | null> {
  const client = getServiceClient();
  const { data } = await client
    .from('staff_users')
    .select('id, name, role')
    .or(`id.eq.${id},auth_id.eq.${id}`)
    .eq('active', true)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, name: data.name as string, role: data.role as StaffRole };
}

/** True when the auth user is an admin. */
export async function isAdmin(authUserId: string): Promise<boolean> {
  const identity = await getStaffIdentityByAnyId(authUserId);
  return identity?.role === 'admin';
}