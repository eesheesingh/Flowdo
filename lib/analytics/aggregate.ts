import { isBefore } from "@/lib/tasks/date-ranges";

export type MinimalTaskRow = {
  id: string;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  project_id: string | null;
  due_date: string | null;
  completed_at: string | null;
};

export function countByStatus(tasks: MinimalTaskRow[]): { created: number; completed: number } {
  return {
    created: tasks.length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
  };
}

export function completionRate(created: number, completed: number): number {
  return created === 0 ? 0 : Math.round((completed / created) * 100);
}

export function countOverdue(tasks: MinimalTaskRow[], now: Date): number {
  const nowIso = now.toISOString();
  return tasks.filter((t) => t.status !== "COMPLETED" && t.due_date !== null && isBefore(t.due_date, nowIso)).length;
}

export function groupByProject(
  tasks: MinimalTaskRow[],
  projects: { id: string; name: string }[]
): { label: string; count: number }[] {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const key = t.project_id ?? "__inbox__";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = [...counts.entries()].map(([key, count]) => ({
    label: key === "__inbox__" ? "Inbox" : nameById.get(key) ?? "Inbox",
    count,
  }));
  rows.sort((a, b) => b.count - a.count);
  return rows;
}

const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export function groupByPriority(
  tasks: MinimalTaskRow[]
): { label: (typeof PRIORITY_ORDER)[number]; count: number }[] {
  const counts = new Map<string, number>(PRIORITY_ORDER.map((p) => [p, 0]));
  for (const t of tasks) counts.set(t.priority, (counts.get(t.priority) ?? 0) + 1);
  return PRIORITY_ORDER.map((label) => ({ label, count: counts.get(label)! }));
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(d: Date): string {
  return `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Monday-first index, matching lib/calendar/month.ts's own mondayIndex.
function mondayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

function startOfWeekUTC(d: Date): Date {
  const day = startOfUTCDay(d);
  day.setUTCDate(day.getUTCDate() - mondayIndex(day));
  return day;
}

export function bucketCompletionTrend(
  tasks: MinimalTaskRow[],
  period: "daily" | "weekly" | "monthly",
  now: Date
): { label: string; count: number }[] {
  const completed = tasks.filter((t) => t.completed_at !== null);

  if (period === "daily") {
    const today = startOfUTCDay(now);
    const buckets = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - (13 - i));
      return { start: d, label: dayLabel(d), count: 0 };
    });
    for (const t of completed) {
      const day = startOfUTCDay(new Date(t.completed_at!));
      const bucket = buckets.find((b) => b.start.getTime() === day.getTime());
      if (bucket) bucket.count++;
    }
    return buckets.map(({ label, count }) => ({ label, count }));
  }

  if (period === "weekly") {
    const thisWeekStart = startOfWeekUTC(now);
    const buckets = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(thisWeekStart);
      d.setUTCDate(d.getUTCDate() - (7 - i) * 7);
      return { start: d, label: dayLabel(d), count: 0 };
    });
    for (const t of completed) {
      const weekStart = startOfWeekUTC(new Date(t.completed_at!));
      const bucket = buckets.find((b) => b.start.getTime() === weekStart.getTime());
      if (bucket) bucket.count++;
    }
    return buckets.map(({ label, count }) => ({ label, count }));
  }

  // monthly
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth(), label: `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`, count: 0 };
  });
  for (const t of completed) {
    const d = new Date(t.completed_at!);
    const bucket = buckets.find((b) => b.year === d.getUTCFullYear() && b.month === d.getUTCMonth());
    if (bucket) bucket.count++;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}
