/**
 * In-memory sliding-window rate limiter for the results-unlock endpoint.
 *
 * Tracks attempts per IP within a configurable window. The window and max
 * attempts come from admin settings. State is process-local, so it resets on
 * restart — acceptable for a per-IP brute-force guard on a low-traffic portal.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining attempts before lockout (0 when locked out). */
  remaining: number;
  /** Seconds until the window resets (0 when locked out). */
  retryAfterSeconds: number;
}

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

/** Prune old timestamps and return the current count within the window. */
function prune(bucket: Bucket, windowMs: number, now: number): number {
  const cutoff = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
  return bucket.timestamps.length;
}

/**
 * Check whether a request from `key` is allowed. Records the attempt when
 * `consume` is true (i.e. on a failed unlock).
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMinutes: number,
  consume: boolean,
): RateLimitResult {
  const windowMs = windowMinutes * 60 * 1000;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  const count = prune(bucket, windowMs, now);
  if (count >= maxAttempts) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((oldest + windowMs - now) / 1000),
    );
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  if (consume) {
    bucket.timestamps.push(now);
  }
  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - count - (consume ? 1 : 0)),
    retryAfterSeconds: 0,
  };
}

/** Best-effort cleanup of stale buckets to bound memory. */
export function clearRateLimitBuckets(): void {
  buckets.clear();
}