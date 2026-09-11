import { describe, it, expect } from "vitest";
import { deriveNotifications } from "./derive";

const now = new Date("2026-03-15T12:00:00.000Z");
const task = (o: Partial<Record<string, unknown>>) => ({
  id: "t", user_id: "u", project_id: null, parent_task_id: null, title: "T",
  description: null, status: "TODO", priority: "MEDIUM", due_date: null, completed_at: null,
  position: 0, created_at: "", updated_at: "", recurrence: "NEVER", recurrence_rule: null, ...o,
}) as never;

describe("deriveNotifications", () => {
  it("flags an overdue task", () => {
    const out = deriveNotifications([task({ id: "a", due_date: "2026-03-10T09:00:00Z" })], new Set(), now);
    expect(out.map((n) => n.type)).toContain("overdue");
    expect(out.find((n) => n.type === "overdue")!.key).toBe("overdue:a");
  });

  it("flags a task due within 24h as due-soon, not overdue", () => {
    const out = deriveNotifications([task({ id: "b", due_date: "2026-03-15T20:00:00Z" })], new Set(), now);
    expect(out.some((n) => n.type === "due-soon" && n.key === "due-soon:b")).toBe(true);
    expect(out.some((n) => n.type === "overdue")).toBe(false);
  });

  it("excludes completed tasks and subtasks", () => {
    const out = deriveNotifications([
      task({ id: "c", due_date: "2026-03-10T09:00:00Z", status: "COMPLETED" }),
      task({ id: "d", due_date: "2026-03-10T09:00:00Z", parent_task_id: "p" }),
    ], new Set(), now);
    expect(out.filter((n) => n.type !== "daily-summary")).toEqual([]);
  });

  it("emits one daily-summary when there is something due or overdue", () => {
    const out = deriveNotifications([task({ id: "e", due_date: "2026-03-10T09:00:00Z" })], new Set(), now);
    const summary = out.filter((n) => n.type === "daily-summary");
    expect(summary).toHaveLength(1);
    expect(summary[0]!.key).toBe("daily-summary:2026-03-15");
    expect(summary[0]!.message).toMatch(/overdue/);
  });

  it("emits no daily-summary when nothing is due or overdue", () => {
    const out = deriveNotifications([task({ id: "f", due_date: "2026-03-20T09:00:00Z" })], new Set(), now);
    expect(out.some((n) => n.type === "daily-summary")).toBe(false);
  });

  it("drops items whose key is in readKeys", () => {
    const out = deriveNotifications([task({ id: "g", due_date: "2026-03-10T09:00:00Z" })], new Set(["overdue:g"]), now);
    expect(out.some((n) => n.key === "overdue:g")).toBe(false);
  });

  it("sorts overdue before due-soon before summary", () => {
    const out = deriveNotifications([
      task({ id: "h", due_date: "2026-03-15T20:00:00Z" }),
      task({ id: "i", due_date: "2026-03-01T09:00:00Z" }),
    ], new Set(), now);
    expect(out.map((n) => n.type)).toEqual(["overdue", "due-soon", "daily-summary"]);
  });
});
