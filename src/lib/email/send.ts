/**
 * Email delivery via Resend, behind a small provider-neutral surface so a
 * future swap (SMTP, other provider) is a config change, not a rewrite.
 */

import { Resend } from 'resend';
import { getServerEnv } from '@/lib/config';

let client: Resend | null = null;

function resend(): Resend {
  if (!client) {
    client = new Resend(getServerEnv().RESEND_API_KEY);
  }
  return client;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Optional attachment — used to attach the encrypted PDF when desired. */
  attachment?: { filename: string; content: Buffer };
}

/**
 * Send an email. Returns the Resend message id, or throws on error.
 * @throws if the email fails to send.
 */
export async function sendEmail(params: SendEmailParams): Promise<string> {
  const env = getServerEnv();
  // When a test recipient is configured, route all mail there (dev helper).
  const to = env.EMAIL_TEST_TO ?? params.to;
  const { error, data } = await resend().emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: params.subject,
    html: params.html,
    attachments: params.attachment
      ? [{ filename: params.attachment.filename, content: params.attachment.content }]
      : undefined,
  });
  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
  return data?.id ?? '';
}