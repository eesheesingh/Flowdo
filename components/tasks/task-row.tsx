import { Repeat, CalendarDays } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];

const PRIORITY_LABEL: Record<TaskRowData["priority"], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const PRIORITY_CLASS: Record<TaskRowData["priority"], string> = {
  LOW: "bg-surface-container text-on-surface-variant",
  MEDIUM: "",
  HIGH: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  URGENT: "bg-error-container text-on-error-container",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// due_date is stored as UTC midnight. Formatting with the viewer's local
// timezone (e.g. toLocaleDateString) can render the previous calendar day
// for negative UTC offsets, and resolves differently between SSR and the
// browser - a hydration-mismatch risk. Reading UTC components directly keeps
// every viewer (and both render passes) on the same calendar date.
function formatDueDate(dueDate: string): string {
  const d = new Date(dueDate);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function TaskRow({
  task,
  onOpen,
  onToggleComplete,
  labels,
  readOnly = false,
}: {
  task: TaskRowData;
  onOpen: (task: TaskRowData) => void;
  onToggleComplete: (task: TaskRowData) => void;
  labels?: { id: string; name: string; color: string }[];
  readOnly?: boolean;
}) {
  const isCompleted = task.status === "COMPLETED";

  return (
    <div className="group flex items-start gap-3 rounded-xl bg-surface-lowest p-3 shadow-xs transition-all hover:shadow-sm">
      <Checkbox
        checked={isCompleted}
        disabled={readOnly}
        onCheckedChange={() => onToggleComplete(task)}
        onClick={(e) => e.stopPropagation()}
        aria-label={isCompleted ? "Reopen task" : "Complete task"}
        className="mt-0.5 shrink-0"
      />
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 text-left"
      >
        <span
          className={cn(
            "block truncate text-sm text-on-surface",
            isCompleted && "text-on-surface-variant line-through"
          )}
        >
          {task.title}
        </span>
      </button>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {labels && labels.length > 0 && (
          <span className="flex shrink-0 gap-1">
            {labels.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs"
                style={{ backgroundColor: `${l.color}20`, color: l.color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} aria-hidden="true" />
                {l.name}
              </span>
            ))}
          </span>
        )}
        {task.priority !== "MEDIUM" && (
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", PRIORITY_CLASS[task.priority])}>
            {PRIORITY_LABEL[task.priority]}
          </span>
        )}
        {task.due_date && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-on-surface-variant">
            <CalendarDays className="h-3 w-3" />
            {formatDueDate(task.due_date)}
          </span>
        )}
        {task.recurrence !== "NEVER" && (
          <Repeat className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" aria-label="Repeats" />
        )}
      </div>
    </div>
  );
}
