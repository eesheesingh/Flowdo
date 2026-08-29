import { TaskRow } from "./task-row";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CheckCircle2 } from "lucide-react";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];

export function TaskList({
  tasks,
  onOpenTask,
  onToggleComplete,
  emptyTitle,
  emptyDescription,
}: {
  tasks: TaskRowData[];
  onOpenTask: (task: TaskRowData) => void;
  onToggleComplete: (task: TaskRowData) => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (tasks.length === 0) {
    return <EmptyState icon={CheckCircle2} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} onOpen={onOpenTask} onToggleComplete={onToggleComplete} />
      ))}
    </div>
  );
}
