import { describe, it, expect } from "vitest";
import { parseFilterParams } from "./filter-params";

describe("parseFilterParams", () => {
  it("returns an empty object when nothing is set", () => {
    expect(parseFilterParams({})).toEqual({});
  });

  it("parses status, priority, search, and sort", () => {
    expect(
      parseFilterParams({ status: "TODO", priority: "HIGH", q: "milk", sort: "due_date" })
    ).toEqual({ status: "TODO", priority: "HIGH", search: "milk", sort: "due_date" });
  });

  it("ignores unrecognized values instead of throwing", () => {
    expect(parseFilterParams({ status: "NOT_A_STATUS", sort: "nonsense" })).toEqual({});
  });
});
