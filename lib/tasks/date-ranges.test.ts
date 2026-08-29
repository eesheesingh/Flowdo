import { describe, it, expect } from "vitest";
import { getTodayRange, isBefore, isWithinRange } from "./date-ranges";

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

describe("isBefore", () => {
  it("returns false for the same instant in different string formats (the actual bug this exists to catch)", () => {
    expect(isBefore("2026-08-29T00:00:00+00:00", "2026-08-29T00:00:00.000Z")).toBe(false);
  });

  it("returns true when the first instant is genuinely earlier", () => {
    expect(isBefore("2026-08-28T23:59:59.000Z", "2026-08-29T00:00:00.000Z")).toBe(true);
  });

  it("returns false when the first instant is genuinely later", () => {
    expect(isBefore("2026-08-29T00:00:01.000Z", "2026-08-29T00:00:00.000Z")).toBe(false);
  });
});

describe("isWithinRange", () => {
  it("includes the exact start instant regardless of string format", () => {
    expect(isWithinRange("2026-08-29T00:00:00+00:00", "2026-08-29T00:00:00.000Z", "2026-08-30T00:00:00.000Z")).toBe(true);
  });

  it("excludes the exact end instant", () => {
    expect(isWithinRange("2026-08-30T00:00:00+00:00", "2026-08-29T00:00:00.000Z", "2026-08-30T00:00:00.000Z")).toBe(false);
  });

  it("excludes an instant before start", () => {
    expect(isWithinRange("2026-08-28T23:59:59.000Z", "2026-08-29T00:00:00.000Z", "2026-08-30T00:00:00.000Z")).toBe(false);
  });
});
