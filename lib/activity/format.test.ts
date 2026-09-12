import { describe, it, expect } from "vitest";
import { describeActivity } from "./format";

describe("describeActivity", () => {
  it("describes task lifecycle actions", () => {
    expect(describeActivity({ action: "task.created", metadata: { title: "Ship docs" } })).toBe('Created "Ship docs"');
    expect(describeActivity({ action: "task.completed", metadata: { title: "Ship docs" } })).toBe("Completed this task");
    expect(describeActivity({ action: "task.reopened", metadata: null })).toBe("Reopened this task");
    expect(describeActivity({ action: "task.updated", metadata: null })).toBe("Updated this task");
    expect(describeActivity({ action: "task.deleted", metadata: { title: "Ship docs" } })).toBe('Deleted "Ship docs"');
  });

  it("describes project actions", () => {
    expect(describeActivity({ action: "project.created", metadata: { name: "Website" } })).toBe('Created project "Website"');
    expect(describeActivity({ action: "project.archived", metadata: { name: "Website" } })).toBe("Archived this project");
    expect(describeActivity({ action: "project.updated", metadata: null })).toBe("Updated this project");
    expect(describeActivity({ action: "project.deleted", metadata: { name: "Website" } })).toBe('Deleted project "Website"');
  });

  it("falls back to the raw action for anything unknown", () => {
    expect(describeActivity({ action: "task.frobnicated", metadata: null })).toBe("task.frobnicated");
  });
});
