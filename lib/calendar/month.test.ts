import { describe, it, expect } from "vitest";
import { buildMonthGrid, monthRange } from "./month";

describe("buildMonthGrid", () => {
  it("March 2026 starts on Sunday and spans 6 weeks", () => {
    const grid = buildMonthGrid(2026, 3);
    expect(grid.length).toBe(6);
    expect(grid[0]!.length).toBe(7);
    // Monday-first: 2026-03-01 is a Sunday, so it's the last cell of week 0
    expect(grid[0]![6]).toEqual({ date: "2026-03-01", inMonth: true });
    expect(grid[0]![0]).toEqual({ date: "2026-02-23", inMonth: false });
  });

  it("February 2026 (28 days, starts Sunday) spans 5 weeks", () => {
    const grid = buildMonthGrid(2026, 2);
    expect(grid.length).toBe(5);
    expect(grid[0]![6]).toEqual({ date: "2026-02-01", inMonth: true });
    expect(grid[4]![5]).toEqual({ date: "2026-02-28", inMonth: true });
  });

  it("February 2028 is a leap month with 29 days", () => {
    const grid = buildMonthGrid(2028, 2);
    const flat = grid.flat();
    expect(flat.some((c) => c!.date === "2028-02-29" && c!.inMonth)).toBe(true);
  });

  it("every week has exactly 7 cells and the whole grid is contiguous", () => {
    const flat = buildMonthGrid(2026, 11).flat();
    for (let i = 1; i < flat.length; i++) {
      const prev = new Date(flat[i - 1]!.date + "T00:00:00Z").getTime();
      const cur = new Date(flat[i]!.date + "T00:00:00Z").getTime();
      expect(cur - prev).toBe(86400000);
    }
  });
});

describe("monthRange", () => {
  it("covers the padded grid as [start, end) instants", () => {
    const { start, end } = monthRange(2026, 3);
    expect(start).toBe("2026-02-23T00:00:00.000Z");
    expect(end).toBe("2026-04-06T00:00:00.000Z"); // day after the last grid cell
  });
});
