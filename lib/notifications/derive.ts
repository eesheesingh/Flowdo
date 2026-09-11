import { getTodayRange } from "@/lib/tasks/date-ranges";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];

export type DerivedNotification = {
  key: string;
  type: "overdue" | "due-soon" | "daily-summary";
  title: string;
  message: string;
  taskId: string | null;
  createdAt: string;
};

export function deriveNotifications(tasks: TaskRow[], readKeys: Set<string>, now: Date): DerivedNotification[] {
  const { start } = getTodayRange(now);
  const soonCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000).getTime();
  const startMs = new Date(start).getTime();

  const open = tasks.filter((t) => t.status !== "COMPLETED" && t.parent_task_id === null && t.due_date);

  const overdue: DerivedNotification[] = [];
  const dueSoon: DerivedNotification[] = [];

  for (const t of open) {
    const due = new Date(t.due_date!).getTime();
    if (due < startMs) {
      overdue.push({
        key: `overdue:${t.id}`, type: "overdue", title: t.title,
        message: "Overdue", taskId: t.id, createdAt: t.due_date!,
      });
    } else if (due <= soonCutoff) {
      dueSoon.push({
        key: `due-soon:${t.id}`, type: "due-soon", title: t.title,
        message: "Due soon", taskId: t.id, createdAt: t.due_date!,
      });
    }
  }

  dueSoon.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  overdue.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const summary: DerivedNotification[] = [];
  const dueTodayCount = open.filter((t) => {
    const due = new Date(t.due_date!).getTime();
    return due >= startMs && due < startMs + 24 * 60 * 60 * 1000;
  }).length;
  if (dueTodayCount + overdue.length > 0) {
    const day = start.slice(0, 10);
    summary.push({
      key: `daily-summary:${day}`, type: "daily-summary", title: "Today's summary",
      message: `${dueTodayCount} due today · ${overdue.length} overdue`,
      taskId: null, createdAt: start,
    });
  }

  return [...overdue, ...dueSoon, ...summary].filter((n) => !readKeys.has(n.key));
}
