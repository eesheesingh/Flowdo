import { describe, it, expect } from "vitest";
import { nextDueDate } from "./recurrence";

const iso = (d: Date) => d.toISOString();

describe("nextDueDate", () => {
  it("DAILY adds one day", () => {
    expect(iso(nextDueDate(new Date("2026-03-15T09:00:00.000Z"), "DAILY", null)))
      .toBe("2026-03-16T09:00:00.000Z");
  });

  it("WEEKLY adds seven days", () => {
    expect(iso(nextDueDate(new Date("2026-03-15T09:00:00.000Z"), "WEEKLY", null)))
      .toBe("2026-03-22T09:00:00.000Z");
  });

  it("MONTHLY adds one calendar month", () => {
    expect(iso(nextDueDate(new Date("2026-03-15T09:00:00.000Z"), "MONTHLY", null)))
      .toBe("2026-04-15T09:00:00.000Z");
  });

  it("MONTHLY clamps to the last day when the target month is shorter", () => {
    expect(iso(nextDueDate(new Date("2026-01-31T09:00:00.000Z"), "MONTHLY", null)))
      .toBe("2026-02-28T09:00:00.000Z");
  });

  it("MONTHLY clamps to Feb 29 in a leap year", () => {
    expect(iso(nextDueDate(new Date("2028-01-31T09:00:00.000Z"), "MONTHLY", null)))
      .toBe("2028-02-29T09:00:00.000Z");
  });

  it("YEARLY adds one year and clamps Feb 29 → Feb 28", () => {
    expect(iso(nextDueDate(new Date("2028-02-29T09:00:00.000Z"), "YEARLY", null)))
      .toBe("2029-02-28T09:00:00.000Z");
  });

  it("CUSTOM every 3 days", () => {
    expect(iso(nextDueDate(new Date("2026-03-15T09:00:00.000Z"), "CUSTOM", { interval: 3, unit: "day" })))
      .toBe("2026-03-18T09:00:00.000Z");
  });

  it("CUSTOM every 2 months clamps", () => {
    expect(iso(nextDueDate(new Date("2026-01-31T09:00:00.000Z"), "CUSTOM", { interval: 2, unit: "month" })))
      .toBe("2026-03-31T09:00:00.000Z");
  });

  it("does not mutate the input date", () => {
    const d = new Date("2026-03-15T09:00:00.000Z");
    nextDueDate(d, "DAILY", null);
    expect(iso(d)).toBe("2026-03-15T09:00:00.000Z");
  });
});
