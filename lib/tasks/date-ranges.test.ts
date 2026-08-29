import { describe, it, expect } from "vitest";
import { getTodayRange } from "./date-ranges";

describe("getTodayRange", () => {
  it("returns UTC midnight boundaries for the given day", () => {
    const { start, end } = getTodayRange(new Date("2026-03-15T14:30:00Z"));
    expect(start).toBe("2026-03-15T00:00:00.000Z");
    expect(end).toBe("2026-03-16T00:00:00.000Z");
  });

  it("rolls over correctly at month/year boundaries", () => {
    const { start, end } = getTodayRange(new Date("2026-12-31T23:59:00Z"));
    expect(start).toBe("2026-12-31T00:00:00.000Z");
    expect(end).toBe("2027-01-01T00:00:00.000Z");
  });
});
