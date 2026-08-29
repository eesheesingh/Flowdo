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
}: {
  task: TaskRowData;
  onOpen: (task: TaskRowData) => void;
  onToggleComplete: (task: TaskRowData) => void;
}) {
  const isCompleted = task.status === "COMPLETED";

  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted">
      <input
        type="checkbox"
        role="checkbox"
        checked={isCompleted}
        onChange={(e) => {
          e.stopPropagation();
          onToggleComplete(task);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={isCompleted ? "Reopen task" : "Complete task"}
        className="h-4 w-4 shrink-0 rounded border-border"
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
    </div>
  );
}
