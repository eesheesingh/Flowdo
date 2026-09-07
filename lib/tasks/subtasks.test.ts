import { describe, it, expect } from "vitest";
import { subtaskProgress } from "./subtasks";

describe("subtaskProgress", () => {
  it("returns 0/0 for no subtasks", () => {
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0 });
  });

  it("counts COMPLETED rows as done", () => {
    expect(
      subtaskProgress([{ status: "COMPLETED" }, { status: "TODO" }, { status: "COMPLETED" }])
    ).toEqual({ done: 2, total: 3 });
  });

  it("treats every non-COMPLETED status as not done", () => {
    expect(
      subtaskProgress([{ status: "IN_PROGRESS" }, { status: "CANCELLED" }])
    ).toEqual({ done: 0, total: 2 });
  });
});
