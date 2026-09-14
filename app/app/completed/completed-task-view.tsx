"use client";
import { TaskView } from "@/components/tasks/task-view";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];
type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];
type LabelRowData = Database["flowdo"]["Tables"]["labels"]["Row"];

// completed_at is a UTC timestamp; slicing to the date portion avoids the
// SSR/client hydration mismatch that toLocaleDateString-based day math risks
// (see the identical convention in components/tasks/task-row.tsx).
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(iso: string): string {
  const now = new Date();
  const key = dayKey(iso);
  const todayKey = dayKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (key === todayKey) return "Today";
  if (key === dayKey(yesterday.toISOString())) return "Yesterday";
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// A function prop can't cross the Server -> Client Component boundary (Next.js
// can only serialize plain data across it), so `groupBy` must be created here,
// entirely client-side, rather than passed in from the server-rendered page.
function completedGroupLabel(task: TaskRowData): string {
  if (!task.completed_at) return "Completed";
  return dayLabel(task.completed_at);
}

export function CompletedTaskView(props: {
  initialTasks: TaskRowData[];
  projects: ProjectRowData[];
  labels: LabelRowData[];
  userId: string;
  baseFilters: { status: "COMPLETED"; parentTaskId: null; sort: "completed_at" };
}) {
  return (
    <TaskView
      {...props}
      viewKey="completed"
      emptyState={{
        default: { title: "No completed tasks yet", description: "Tasks you finish will show up here." },
        filtered: { title: "No completed tasks match your filters", description: "Try clearing a filter or search term." },
      }}
      showProjectFilter
      hideStatusFilter
      hideManualSort
      groupBy={completedGroupLabel}
    />
  );
}
