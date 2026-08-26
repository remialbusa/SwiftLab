/**
 * Client-side fetch wrapper.
 *
 * Adds the `ngrok-skip-browser-warning` header so the app works through an
 * ngrok free-tier tunnel. ngrok shows an interstitial page in front of HTML
 * browser traffic on the free plan, which also 403s client-side fetch/XHR
 * calls. Sending this header from the client bypasses the interstitial for
 * every request (the documented approach — ngrok forbids injecting it
 * server-side via traffic policy). The header is harmless on non-ngrok hosts.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("ngrok-skip-browser-warning", "1");
  return fetch(input, { ...init, headers });
}