import { describe, it, expect } from "vitest";
import { parseFilterParams, buildFullFilters } from "./filter-params";

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

  it("parses a label id from the `label` param", () => {
    const parsed = parseFilterParams({ label: "b1e6d2a0-0000-4000-8000-000000000000" });
    expect(parsed.labelId).toBe("b1e6d2a0-0000-4000-8000-000000000000");
  });

  it("ignores a non-uuid `label` param", () => {
    expect(parseFilterParams({ label: "not-a-uuid" }).labelId).toBeUndefined();
  });
});

describe("buildFullFilters", () => {
  it("never clobbers a base filter's projectId: null when no ?project= param is present (regression for Inbox bug)", () => {
    const result = buildFullFilters({ projectId: null, excludeCompleted: true }, {});
    expect(result.projectId).toBeNull();
    expect("projectId" in result).toBe(true);
  });

  it("includes projectId from the ?project= param when present", () => {
    const result = buildFullFilters({ excludeCompleted: true }, { project: "abc-123" });
    expect(result.projectId).toBe("abc-123");
  });

  it("never lets a URL-supplied status override a base filter's status (regression: Completed view could be made to show non-completed tasks)", () => {
    const result = buildFullFilters({ status: "COMPLETED" }, { status: "TODO" });
    expect(result).toEqual({ status: "COMPLETED" });
  });

  it("still merges status/priority/search/sort via parseFilterParams", () => {
    const result = buildFullFilters(
      { excludeCompleted: true },
      { status: "TODO", priority: "HIGH", q: "milk", sort: "due_date" }
    );
    expect(result).toEqual({
      excludeCompleted: true,
      status: "TODO",
      priority: "HIGH",
      search: "milk",
      sort: "due_date",
    });
  });
});
