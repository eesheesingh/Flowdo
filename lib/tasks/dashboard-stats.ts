import { getTodayRange } from "./date-ranges";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];

export function computeDashboardStats(tasks: TaskRow[], now: Date = new Date()) {
  const { start, end } = getTodayRange(now);

  const todayTasks = tasks.filter((t) => t.due_date && t.due_date >= start && t.due_date < end);
  const todayCompleted = todayTasks.filter((t) => t.status === "COMPLETED").length;

  const overdueCount = tasks.filter(
    (t) => t.status !== "COMPLETED" && t.due_date && t.due_date < start
  ).length;

  return { todayTotal: todayTasks.length, todayCompleted, overdueCount };
}
