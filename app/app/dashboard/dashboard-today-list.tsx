"use client";
import { TaskList } from "@/components/tasks/task-list";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];

export function DashboardTodayList({ tasks }: { tasks: TaskRowData[] }) {
  return (
    <TaskList
      tasks={tasks}
      onOpenTask={() => {}}
      onToggleComplete={() => {}}
      emptyTitle="Nothing due today"
      emptyDescription="Enjoy the calm."
    />
  );
}
