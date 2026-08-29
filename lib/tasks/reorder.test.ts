import { describe, it, expect } from "vitest";
import { calculateNewPosition } from "./reorder";

describe("calculateNewPosition", () => {
  it("returns the midpoint between two neighbors", () => {
    expect(calculateNewPosition(10, 20)).toBe(15);
  });

  it("returns a value below the only following item when dropped at the start", () => {
    expect(calculateNewPosition(null, 10)).toBe(0);
  });

  it("returns a value above the only preceding item when dropped at the end", () => {
    expect(calculateNewPosition(10, null)).toBe(20);
  });

  it("returns 0 when the list is empty (no neighbors at all)", () => {
    expect(calculateNewPosition(null, null)).toBe(0);
  });

  it("returns the tied midpoint when both neighbors share the same position (documents current behavior; ties should no longer occur once new tasks get distinct Date.now() seeded positions)", () => {
    expect(calculateNewPosition(0, 0)).toBe(0);
  });
});
