import { describe, it, expect } from "vitest";
import { taskSchema, projectSchema } from "./tasks";

describe("taskSchema", () => {
  it("requires only a title", () => {
    expect(taskSchema.safeParse({ title: "Buy milk" }).success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(taskSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("accepts a full task", () => {
    const result = taskSchema.safeParse({
      title: "Ship feature",
      description: "Write the plan and implement it",
      dueDate: "2026-09-01",
      priority: "HIGH",
      projectId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid priority", () => {
    expect(taskSchema.safeParse({ title: "x", priority: "SUPER_URGENT" }).success).toBe(false);
  });
});

describe("projectSchema", () => {
  it("requires a name, color, and icon", () => {
    expect(projectSchema.safeParse({ name: "Marketing", color: "#4F46E5", icon: "folder" }).success).toBe(true);
  });

  it("rejects a missing name", () => {
    expect(projectSchema.safeParse({ color: "#4F46E5", icon: "folder" }).success).toBe(false);
  });
});
