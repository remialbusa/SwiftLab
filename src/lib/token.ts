/**
 * Token utilities for tracking links and magic links.
 *
 * Design: we generate a high-entropy random token, store ONLY its SHA-256 hash
 * server-side, and hand the plaintext to the patient (email). This keeps a DB
 * leak from directly exposing working links.
 */

import { createHash, randomBytes } from 'node:crypto';

/** Generate a URL-safe random token (32 bytes -> 43 base64url chars). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex hash of a token — what we store in the DB. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison of two hex hashes. */
export function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  let diff = 0;
  for (let i = 0; i < aBuf.length; i++) {
    diff |= aBuf[i] ^ bBuf[i];
  }
  return diff === 0;
}

/** Human-friendly trackingcode for staff search (e.g. `SL-7K2F9Q`). */
export function generateTrackingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  const chars = Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  );
  return `SL-${chars.join('')}`;
}