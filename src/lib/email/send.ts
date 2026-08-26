/**
 * Email delivery via Resend or SMTP (nodemailer), behind a small
 * provider-neutral surface so a future swap is a config change.
 *
 * Provider selection:
 * - If `SMTP_HOST` is set  -> send via SMTP (Gmail, Brevo, any relay).
 * - Otherwise              -> send via Resend.
 *
 * Both providers deliver to the real recipient. The optional `EMAIL_TEST_TO`
 * fallback still applies: when a primary send fails, it is retried to the
 * test address (free tiers often restrict recipients).
 */

import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { getServerEnv } from '@/lib/config';

let client: Resend | null = null;

function resend(): Resend {
  if (!client) {
    client = new Resend(getServerEnv().RESEND_API_KEY);
  }
  return client;
}

// Cached transports keyed by host+user so repeated sends reuse the connection.
const smtpTransports = new Map<string, nodemailer.Transporter>();

function smtp(): nodemailer.Transporter {
  const env = getServerEnv();
  const host = env.SMTP_HOST;
  if (!host) {
    throw new Error('SMTP_HOST is not configured.');
  }
  const key = `${host}:${env.SMTP_PORT}:${env.SMTP_USER ?? ''}`;
  let transport = smtpTransports.get(key);
  if (!transport) {
    transport = nodemailer.createTransport({
      host,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' }
        : undefined,
    });
    smtpTransports.set(key, transport);
  }
  return transport;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Optional attachment — used to attach the encrypted PDF when desired. */
  attachment?: { filename: string; content: Buffer };
}

/**
 * Send an email to the real recipient. Returns a message id, or throws.
 *
 * Dev fallback: if `EMAIL_TEST_TO` is configured AND the primary send fails
 * (e.g. Resend's free tier only delivers to verified addresses), the email is
 * retried to the test address and a warning is logged. In production (no
 * `EMAIL_TEST_TO`), failures throw as-is.
 * @throws if the email fails to send (including the fallback when set).
 */
export async function sendEmail(params: SendEmailParams): Promise<string> {
  const env = getServerEnv();

  try {
    return await dispatch(params.to, params);
  } catch (primaryError) {
    // Real recipient delivery failed. If a dev fallback address is
    // configured, retry there instead of losing the email entirely.
    if (env.EMAIL_TEST_TO && env.EMAIL_TEST_TO !== params.to) {
      console.warn(
        `[email] primary send to ${params.to} failed (${primaryError instanceof Error ? primaryError.message : 'unknown'}); ` +
          `retrying to dev fallback ${env.EMAIL_TEST_TO}`,
      );
      return await dispatch(env.EMAIL_TEST_TO, params);
    }
    throw primaryError;
  }
}

/** Low-level delivery to a single recipient. Throws on provider error. */
async function dispatch(to: string, params: SendEmailParams): Promise<string> {
  const env = getServerEnv();
  if (env.SMTP_HOST) {
    const info = await smtp().sendMail({
      from: env.EMAIL_FROM,
      to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachment
        ? [{ filename: params.attachment.filename, content: params.attachment.content }]
        : undefined,
    });
    return info.messageId ?? '';
  }
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