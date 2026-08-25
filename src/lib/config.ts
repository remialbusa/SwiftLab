/**
 * Central environment configuration. All env vars are read here so the rest of
 * the app never touches `process.env` directly. Missing required values throw
 * at startup in production-ish paths (server functions).
 */

import { z } from 'zod';

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1).default('SwiftLab <onboarding@resend.dev>'),
  // Optional: when set, ALL emails are sent to this address instead of the
  // patient's — useful for dev/test when Resend only permits your own address.
  EMAIL_TEST_TO: z.string().email().optional(),
  APP_URL: z.string().url().default('http://localhost:3000'),
  QPDF_PATH: z.string().optional(),
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