/**
 * Middleware for staff-route protection.
 *
 * - Public: `/`, `/order`, `/track`, `/results` (and its subpaths).
 * - Staff: `/admin/*`, `/staff/*` require an authenticated staff session.
 *
 * Note: patient result access uses magic links + a short-lived cookie set by
 * the verify handler, so `/results` itself stays reachable but individual
 * downloads are authorized at the API boundary.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getClientEnv } from '@/lib/config';

const PUBLIC_PREFIXES = ['/order', '/track', '/results', '/staff/login', '/_next', '/favicon.ico'];

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next({ request });
  }

  const env = getClientEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated -> redirect to staff login (unless already there).
  if (!user && pathname !== '/staff/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/staff/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*'],
};