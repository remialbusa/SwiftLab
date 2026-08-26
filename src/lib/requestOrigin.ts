/**
 * Derive the public origin (scheme + host) of the request as seen by the
 * patient. Through ngrok/Cloudflare tunnels the incoming Host header is the
 * tunnel host, so email links point at the public URL, not localhost.
 */
export function requestOrigin(request: Request): string {
  const headers = request.headers;
  const host =
    headers.get('x-forwarded-host') ??
    headers.get('host') ??
    'localhost:3000';
  const proto = headers.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}