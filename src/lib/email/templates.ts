/**
 * Email templates (plain HTML, inline styles). Kept minimal; can be migrated
 * to React Email later without changing call sites.
 */

import { getServerEnv } from '@/lib/config';

function baseLayout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif;background:#f4f6f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#0e7490;padding:20px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;">SwiftLab Portal</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 12px;font-size:18px;color:#0f172a;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;">
                This is an automated message from SwiftLab Portal. Please do not reply.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Order created — patient receives their tracking link + code. */
export function orderConfirmationHtml(params: {
  patientName: string;
  trackingUrl: string;
  trackingCode?: string;
}): string {
  const codeBlock = params.trackingCode
    ? `<p style="color:#334155;font-size:14px;line-height:1.6;">Your tracking code is <strong style="font-family:monospace;font-size:16px;background:#EAF6F5;padding:4px 10px;border-radius:6px;">${params.trackingCode}</strong>. Use it at any time to check your status.</p>`
    : '';
  return baseLayout(
    'Your order has been received',
    `<p style="color:#334155;font-size:14px;line-height:1.6;">Hi ${params.patientName},</p>
     <p style="color:#334155;font-size:14px;line-height:1.6;">Your lab order has been registered. Track its progress here:</p>
     ${codeBlock}
     <p><a href="${params.trackingUrl}" style="display:inline-block;background:#0e7490;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Track my order</a></p>
     <p style="color:#64748b;font-size:12px;">If the button does not work, copy this link: ${params.trackingUrl}</p>`,
  );
}

/** Results ready — patient downloads their encrypted PDF. */
export function resultsReadyHtml(params: {
  patientName: string;
  resultsUrl: string;
  passwordHint: string;
}): string {
  return baseLayout(
    'Your results are ready',
    `<p style="color:#334155;font-size:14px;line-height:1.6;">Hi ${params.patientName},</p>
     <p style="color:#334155;font-size:14px;line-height:1.6;">Your results are ready for download. The PDF is password-protected using your last name and birth date (${params.passwordHint}).</p>
     <p><a href="${params.resultsUrl}" style="display:inline-block;background:#0e7490;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Download results</a></p>
     <p style="color:#64748b;font-size:12px;">If the button does not work, copy this link: ${params.resultsUrl}</p>`,
  );
}

/**
 * Build an absolute URL for email links.
 * Prefers the origin the request actually came in on (public tunnel/domain)
 * so patients never see localhost; falls back to APP_URL.
 */
export function absoluteUrl(path: string, origin?: string): string {
  const base = (origin ?? getServerEnv().APP_URL).replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}