import { describe, expect, it } from "vitest";
import { checkRateLimit, clearRateLimitBuckets } from "@/lib/rateLimit";

const KEY = "test-ip";

describe("checkRateLimit", () => {
  it("allows requests within the limit", () => {
    clearRateLimitBuckets();
    const first = checkRateLimit(KEY, 3, 15, true);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);
    const second = checkRateLimit(KEY, 3, 15, true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("blocks once the limit is consumed", () => {
    clearRateLimitBuckets();
    checkRateLimit(KEY, 2, 15, true);
    checkRateLimit(KEY, 2, 15, true);
    const blocked = checkRateLimit(KEY, 2, 15, false);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("does not consume quota on a non-consuming check", () => {
    clearRateLimitBuckets();
    const check = checkRateLimit(KEY, 2, 15, false);
    expect(check.allowed).toBe(true);
    expect(check.remaining).toBe(2);
  });

  it("tracks keys independently", () => {
    clearRateLimitBuckets();
    checkRateLimit("ip-a", 1, 15, true);
    expect(checkRateLimit("ip-a", 1, 15, false).allowed).toBe(false);
    expect(checkRateLimit("ip-b", 1, 15, false).allowed).toBe(true);
  });
});