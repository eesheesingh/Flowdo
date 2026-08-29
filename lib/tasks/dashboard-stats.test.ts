import { describe, it, expect } from "vitest";
import { computeDashboardStats } from "./dashboard-stats";

const now = new Date("2026-03-15T12:00:00.000Z");

function task(overrides: Partial<{ status: string; due_date: string | null }>) {
  return {
    id: "1",
    user_id: "u1",
    project_id: null,
    parent_task_id: null,
    title: "x",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    due_date: null,
    completed_at: null,
    position: 0,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  } as never;
}

describe("computeDashboardStats", () => {
  it("counts today's total and completed tasks", () => {
    const tasks = [
      task({ due_date: "2026-03-15T09:00:00.000Z", status: "TODO" }),
      task({ due_date: "2026-03-15T18:00:00.000Z", status: "COMPLETED" }),
      task({ due_date: "2026-03-16T09:00:00.000Z", status: "TODO" }),
    ];
    const stats = computeDashboardStats(tasks, now);
    expect(stats.todayTotal).toBe(2);
    expect(stats.todayCompleted).toBe(1);
  });

  it("counts overdue tasks (past due, not completed)", () => {
    const tasks = [
      task({ due_date: "2026-03-10T09:00:00.000Z", status: "TODO" }),
      task({ due_date: "2026-03-10T09:00:00.000Z", status: "COMPLETED" }),
      task({ due_date: "2026-03-20T09:00:00.000Z", status: "TODO" }),
    ];
    expect(computeDashboardStats(tasks, now).overdueCount).toBe(1);
  });
});
