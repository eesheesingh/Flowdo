import { describe, it, expect } from "vitest";
import {
  countByStatus,
  completionRate,
  countOverdue,
  groupByProject,
  groupByPriority,
  bucketCompletionTrend,
  type MinimalTaskRow,
} from "./aggregate";

function task(over: Partial<MinimalTaskRow>): MinimalTaskRow {
  return {
    id: "t",
    status: "TODO",
    priority: "MEDIUM",
    project_id: null,
    due_date: null,
    completed_at: null,
    ...over,
  };
}

describe("countByStatus", () => {
  it("returns 0/0 for no tasks", () => {
    expect(countByStatus([])).toEqual({ created: 0, completed: 0 });
  });

  it("counts created as every row and completed as COMPLETED-status rows", () => {
    const tasks = [
      task({ status: "TODO" }),
      task({ status: "COMPLETED" }),
      task({ status: "COMPLETED" }),
      task({ status: "CANCELLED" }),
    ];
    expect(countByStatus(tasks)).toEqual({ created: 4, completed: 2 });
  });
});

describe("completionRate", () => {
  it("is 0 when created is 0", () => {
    expect(completionRate(0, 0)).toBe(0);
  });

  it("rounds to the nearest percent", () => {
    expect(completionRate(3, 1)).toBe(33);
    expect(completionRate(3, 2)).toBe(67);
  });

  it("is 100 when everything is completed", () => {
    expect(completionRate(5, 5)).toBe(100);
  });
});

describe("countOverdue", () => {
  const now = new Date("2026-03-15T12:00:00.000Z");

  it("is 0 for no tasks", () => {
    expect(countOverdue([], now)).toBe(0);
  });

  it("counts a non-completed task with a past due date", () => {
    expect(countOverdue([task({ due_date: "2026-03-14T00:00:00.000Z" })], now)).toBe(1);
  });

  it("does not count a completed task even if its due date is past", () => {
    expect(countOverdue([task({ status: "COMPLETED", due_date: "2026-03-14T00:00:00.000Z" })], now)).toBe(0);
  });

  it("does not count a task with no due date", () => {
    expect(countOverdue([task({ due_date: null })], now)).toBe(0);
  });

  it("does not count a task due exactly at `now` or later", () => {
    expect(countOverdue([task({ due_date: "2026-03-15T12:00:00.000Z" })], now)).toBe(0);
    expect(countOverdue([task({ due_date: "2026-03-15T12:00:00.001Z" })], now)).toBe(0);
  });
});

describe("groupByProject", () => {
  it("returns an empty array for no tasks", () => {
    expect(groupByProject([], [])).toEqual([]);
  });

  it("labels a null project_id as Inbox", () => {
    expect(groupByProject([task({ project_id: null })], [])).toEqual([{ label: "Inbox", count: 1 }]);
  });

  it("groups all-same-project tasks into one row", () => {
    const projects = [{ id: "p1", name: "Launch" }];
    const tasks = [task({ project_id: "p1" }), task({ project_id: "p1" }), task({ project_id: "p1" })];
    expect(groupByProject(tasks, projects)).toEqual([{ label: "Launch", count: 3 }]);
  });

  it("sorts by count descending", () => {
    const projects = [{ id: "p1", name: "A" }, { id: "p2", name: "B" }];
    const tasks = [task({ project_id: "p1" }), task({ project_id: "p2" }), task({ project_id: "p2" }), task({ project_id: "p2" })];
    expect(groupByProject(tasks, projects)).toEqual([
      { label: "B", count: 3 },
      { label: "A", count: 1 },
    ]);
  });
});

describe("groupByPriority", () => {
  it("includes all 4 priorities in order even at zero", () => {
    expect(groupByPriority([])).toEqual([
      { label: "LOW", count: 0 },
      { label: "MEDIUM", count: 0 },
      { label: "HIGH", count: 0 },
      { label: "URGENT", count: 0 },
    ]);
  });

  it("counts each task under its own priority", () => {
    const tasks = [task({ priority: "URGENT" }), task({ priority: "URGENT" }), task({ priority: "LOW" })];
    expect(groupByPriority(tasks)).toEqual([
      { label: "LOW", count: 1 },
      { label: "MEDIUM", count: 0 },
      { label: "HIGH", count: 0 },
      { label: "URGENT", count: 2 },
    ]);
  });
});

describe("bucketCompletionTrend", () => {
  const now = new Date("2026-03-15T12:00:00.000Z"); // a Sunday

  it("daily: returns 14 zero-filled buckets ending today", () => {
    const buckets = bucketCompletionTrend([], "daily", now);
    expect(buckets).toHaveLength(14);
    expect(buckets[13]).toEqual({ label: "Mar 15", count: 0 });
    expect(buckets[0]).toEqual({ label: "Mar 2", count: 0 });
  });

  it("daily: places a completed task in its UTC day bucket", () => {
    const tasks = [task({ completed_at: "2026-03-15T23:59:59.000Z" })];
    const buckets = bucketCompletionTrend(tasks, "daily", now);
    expect(buckets[13]).toEqual({ label: "Mar 15", count: 1 });
  });

  it("ignores tasks with no completed_at", () => {
    const tasks = [task({ completed_at: null, status: "TODO" })];
    const buckets = bucketCompletionTrend(tasks, "daily", now);
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(0);
  });

  it("weekly: returns 8 Monday-first buckets ending this week", () => {
    const buckets = bucketCompletionTrend([], "weekly", now);
    expect(buckets).toHaveLength(8);
    // 2026-03-15 is a Sunday; that week's Monday is 2026-03-09.
    expect(buckets[7]).toEqual({ label: "Mar 9", count: 0 });
  });

  it("weekly: places a completed task in its Monday-start week bucket", () => {
    const tasks = [task({ completed_at: "2026-03-11T00:00:00.000Z" })]; // Wednesday of the week starting Mar 9
    const buckets = bucketCompletionTrend(tasks, "weekly", now);
    expect(buckets[7]).toEqual({ label: "Mar 9", count: 1 });
  });

  it("monthly: returns 6 month buckets ending this month", () => {
    const buckets = bucketCompletionTrend([], "monthly", now);
    expect(buckets).toHaveLength(6);
    expect(buckets[5]).toEqual({ label: "Mar 2026", count: 0 });
    expect(buckets[0]).toEqual({ label: "Oct 2025", count: 0 });
  });

  it("monthly: places a completed task in its year-month bucket", () => {
    const tasks = [task({ completed_at: "2026-01-20T00:00:00.000Z" })];
    const buckets = bucketCompletionTrend(tasks, "monthly", now);
    expect(buckets.find((b) => b.label === "Jan 2026")).toEqual({ label: "Jan 2026", count: 1 });
  });
});
