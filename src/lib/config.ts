/**
 * Central environment configuration. All env vars are read here so the rest of
 * the app never touches `process.env` directly. Missing required values throw
 * at startup in production-ish paths (server functions).
 */

import { z } from 'zod';

const serverEnvSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    // Resend is required only when SMTP is NOT configured (provider is Resend
    // by default). When SMTP_HOST is set, this may be absent.
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).default('SwiftLab <onboarding@resend.dev>'),
    // Optional dev helper: when set, emails that FAIL to deliver to the real
    // recipient are retried to this address. This is useful while Resend's free
    // tier only permits sending to your own verified address. Remove it (or
    // leave unset) in production so patients always receive their mail.
    EMAIL_TEST_TO: z.string().email().optional(),
    // --- SMTP (optional) ---
    // When SMTP_HOST is set, email goes out via SMTP instead of Resend. This
    // supports free/no-domain providers like Gmail (SMTP_HOST=smtp.gmail.com,
    // port 587, SMTP_USER=<your gmail>, SMTP_PASS=<app password>) or Brevo
    // (smtp-relay.brevo.com, port 587, SMTP_USER=<login>, SMTP_PASS=<SMTP key>),
    // both of which can deliver to ANY recipient without owning a domain.
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    // "true"/"false" string from env -> boolean; defaults to false (STARTTLS).
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .pipe(z.boolean())
      .default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    APP_URL: z.string().url().default('http://localhost:3000'),
    QPDF_PATH: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // If no SMTP host is configured, Resend is the provider and its key is
    // mandatory. Otherwise SMTP drives delivery and Resend may be absent.
    if (!env.SMTP_HOST && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY is required when SMTP_HOST is not set.',
      });
    }
  });

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/** Server-side env (service role key, Resend key). Throws if missing. */
export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Client-safe env (public keys only). */
export function getClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(`Invalid client environment: ${parsed.error.message}`);
  }
  return parsed.data;
}