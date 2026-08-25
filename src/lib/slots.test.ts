import { describe, expect, it } from "vitest";
import { buildSlotWindows } from "@/lib/slots";

describe("buildSlotWindows", () => {
  it("expands hours into 15-minute slots", () => {
    const windows = buildSlotWindows("08:00", "09:00", "2026-08-26");
    expect(windows).toHaveLength(4);
    expect(windows[0]).toEqual({ date: "2026-08-26", start: "08:00", end: "08:15" });
    expect(windows[3]).toEqual({ date: "2026-08-26", start: "08:45", end: "09:00" });
  });

  it("never produces a slot past closing time", () => {
    const windows = buildSlotWindows("08:00", "08:10", "2026-08-26");
    expect(windows).toHaveLength(0);
  });

  it("handles afternoon hours across noon", () => {
    const windows = buildSlotWindows("12:00", "12:30", "2026-08-26");
    expect(windows).toHaveLength(2);
    expect(windows[1]).toEqual({ date: "2026-08-26", start: "12:15", end: "12:30" });
  });
});