import { NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/request';

/**
 * POST /api/v1/staff/logout
 * Ends the staff session and redirects the browser to the staff login page.
 *
 * Uses a RELATIVE Location so browsers resolve it against the current origin —
 * works identically on localhost, ngrok/Cloudflare tunnels, or a custom
 * domain, without depending on forwarded Host headers.
 */
export async function POST(request: Request) {
  const client = await createRequestClient();
  await client.auth.signOut();
  return new NextResponse(null, {
    status: 303,
    headers: { location: '/staff/login' },
  });
}