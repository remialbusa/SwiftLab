import { describe, expect, it } from "vitest";
import { derivePdfPassword, isPdfPasswordValid } from "@/lib/pdf/password";

describe("derivePdfPassword", () => {
  it("derives the canonical password from last name + birth date (MMDDYYYY)", () => {
    expect(derivePdfPassword({ lastName: "Dela Cruz", birthDate: "1990-05-14" })).toBe(
      "delacruz05141990",
    );
  });

  it("strips non-alphanumeric characters from the name", () => {
    expect(derivePdfPassword({ lastName: "O'Neill", birthDate: "2000-01-01" })).toBe(
      "oneill01012000",
    );
  });

  it("accepts alternate birth date formats", () => {
    expect(derivePdfPassword({ lastName: "Smith", birthDate: "05/14/1990" })).toBe(
      "smith05141990",
    );
    expect(derivePdfPassword({ lastName: "Smith", birthDate: "05-14-1990" })).toBe(
      "smith05141990",
    );
  });

  it("rejects invalid birth date formats", () => {
    expect(() => derivePdfPassword({ lastName: "Smith", birthDate: "14-1990" })).toThrow();
  });
});

describe("isPdfPasswordValid", () => {
  it("is case-insensitive and whitespace-tolerant", () => {
    const input = { lastName: "Dela Cruz", birthDate: "1990-05-14" };
    expect(isPdfPasswordValid("DELA CRUZ 05141990", input)).toBe(true);
    expect(isPdfPasswordValid(" delacruz05141990 ", input)).toBe(true);
  });

  it("rejects the wrong name or date", () => {
    const input = { lastName: "Dela Cruz", birthDate: "1990-05-14" };
    expect(isPdfPasswordValid("wrong05141990", input)).toBe(false);
    expect(isPdfPasswordValid("delacruz1991-05-14", input)).toBe(false);
  });
});