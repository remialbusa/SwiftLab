import { describe, expect, it } from "vitest";
import { generateToken, hashToken, safeEqual } from "@/lib/token";

describe("token utilities", () => {
  it("generates a URL-safe token of expected length", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it("generates unique tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });

  it("hashes tokens deterministically with SHA-256", () => {
    const token = "some-token";
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("does not reveal the token through its hash", () => {
    const token = "secret-token";
    const hash = hashToken(token);
    expect(hash).not.toContain(token);
    expect(hash).not.toBe(token);
  });

  it("compares hashes in constant time", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});