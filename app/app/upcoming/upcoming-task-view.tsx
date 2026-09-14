"use client";
import { TaskView } from "@/components/tasks/task-view";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];
type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];
type LabelRowData = Database["flowdo"]["Tables"]["labels"]["Row"];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// due_date is stored as UTC midnight (see task-row.tsx); read UTC components
// so this doesn't drift a day depending on the viewer's offset.
function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// ponytail: buckets "this week" / "this weekend" / everything else into one
// catch-all rather than modeling every calendar edge case (e.g. today being a
// Saturday). Good enough for a glance at what's coming; revisit if that ever
// reads wrong for a real user.
export function upcomingGroupLabel(task: TaskRowData, now: Date = new Date()): string {
  if (!task.due_date) return "Later";
  const due = new Date(task.due_date);
  const dayDiff = Math.round((utcMidnight(due) - utcMidnight(now)) / 86_400_000);
  const dow = due.getUTCDay();
  const month = MONTHS[due.getUTCMonth()];
  const day = due.getUTCDate();

  if (dayDiff === 1) return `Tomorrow · ${WEEKDAYS[dow]}, ${month} ${day}`;
  if (dayDiff >= 2 && dayDiff <= 5) return `${WEEKDAYS[dow]} · ${month} ${day}`;
  if (dayDiff >= 2 && dayDiff <= 9 && (dow === 6 || dow === 0)) {
    const satDay = dow === 6 ? day : day - 1;
    const sunDay = dow === 0 ? day : day + 1;
    return `This weekend · ${month} ${satDay}–${sunDay}`;
  }
  return "Next week & beyond";
}

export function UpcomingTaskView(props: {
  initialTasks: TaskRowData[];
  projects: ProjectRowData[];
  labels: LabelRowData[];
  userId: string;
  baseFilters: { dueDate: "upcoming"; parentTaskId: null; excludeCompleted: true };
}) {
  return (
    <TaskView
      {...props}
      viewKey="upcoming"
      emptyState={{
        default: { title: "No upcoming tasks", description: "Tasks due soon will show up here." },
        filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
      }}
      showProjectFilter
      groupBy={upcomingGroupLabel}
    />
  );
}
