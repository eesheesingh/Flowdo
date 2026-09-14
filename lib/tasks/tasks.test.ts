import { describe, it, expect } from "vitest";
import { computeCompletionStreak } from "./tasks";

describe("computeCompletionStreak", () => {
  it("counts consecutive days ending today", () => {
    const today = new Date("2026-09-15T12:00:00Z");
    const dates = [
      "2026-09-15T09:00:00Z",
      "2026-09-14T20:00:00Z",
      "2026-09-13T08:00:00Z",
    ];
    expect(computeCompletionStreak(dates, today)).toBe(3);
  });

  it("stops at the first gap", () => {
    const today = new Date("2026-09-15T12:00:00Z");
    const dates = ["2026-09-15T09:00:00Z", "2026-09-13T08:00:00Z"];
    expect(computeCompletionStreak(dates, today)).toBe(1);
  });

  it("returns 0 when nothing was completed today", () => {
    const today = new Date("2026-09-15T12:00:00Z");
    expect(computeCompletionStreak(["2026-09-14T09:00:00Z"], today)).toBe(0);
  });

  it("returns 0 for no completions", () => {
    expect(computeCompletionStreak([], new Date())).toBe(0);
  });
});
