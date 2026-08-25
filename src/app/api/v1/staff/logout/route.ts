import { NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/request';

/**
 * POST /api/v1/staff/logout
 * Ends the staff session and redirects the browser to the staff login page.
 */
export async function POST() {
  const client = await createRequestClient();
  await client.auth.signOut();
  return NextResponse.redirect(new URL('/staff/login', process.env.APP_URL ?? 'http://localhost:3000'), 303);
}