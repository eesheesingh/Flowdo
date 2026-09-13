import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];

const PRIORITY_LABEL: Record<TaskRowData["priority"], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
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
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted">
      <input
        type="checkbox"
        role="checkbox"
        checked={isCompleted}
        disabled={readOnly}
        onChange={(e) => {
          e.stopPropagation();
          onToggleComplete(task);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={isCompleted ? "Reopen task" : "Complete task"}
        className="h-4 w-4 shrink-0 rounded border-border disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => onOpen(task)}
        className={cn(
          "flex-1 truncate text-left text-sm",
          isCompleted && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </button>
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
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            task.priority === "URGENT" && "bg-destructive/10 text-destructive",
            task.priority === "HIGH" && "bg-orange-500/10 text-orange-600",
            task.priority === "LOW" && "bg-muted text-muted-foreground"
          )}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
      )}
      {task.due_date && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDueDate(task.due_date)}
        </span>
      )}
      {task.recurrence !== "NEVER" && (
        <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Repeats" />
      )}
    </div>
  );
}
