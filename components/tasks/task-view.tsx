"use client";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { QuickAdd } from "./quick-add";
import { TaskFilters } from "./task-filters";
import { TaskList } from "./task-list";
import { TaskDetailPanel } from "./task-detail-panel";
import { createClient } from "@/lib/supabase/client";
import {
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  reopenTask,
  updateTaskPosition,
  listTasks,
  type ListTasksFilters,
} from "@/lib/tasks/tasks";
import { parseFilterParams, type UserFilterParams } from "@/lib/tasks/filter-params";
import type { TaskInput } from "@/lib/validations/tasks";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];
type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

export interface EmptyStateCopy {
  title: string;
  description: string;
}

export function TaskView({
  initialTasks,
  projects,
  userId,
  baseFilters,
  viewKey,
  emptyState,
  enableReorder = false,
  showProjectFilter = false,
}: {
  initialTasks: TaskRowData[];
  projects: ProjectRowData[];
  userId: string;
  baseFilters: Omit<ListTasksFilters, "priority" | "search" | "sort">;
  viewKey: string;
  emptyState: { default: EmptyStateCopy; filtered: EmptyStateCopy };
  enableReorder?: boolean;
  showProjectFilter?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [openTask, setOpenTask] = React.useState<TaskRowData | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  const userFilters: UserFilterParams & { projectId?: string } = {
    ...parseFilterParams(Object.fromEntries(searchParams.entries())),
    projectId: searchParams.get("project") ?? undefined,
  };
  const hasActiveFilter = Boolean(
    userFilters.status || userFilters.priority || userFilters.search || userFilters.projectId
  );

  const fullFilters: ListTasksFilters = { ...baseFilters, ...userFilters };
  const queryKey = ["tasks", viewKey, fullFilters];

  const { data: tasks } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await listTasks(supabase, fullFilters);
      if (error) setMutationError(error);
      return data ?? [];
    },
    initialData: JSON.stringify(fullFilters) === JSON.stringify(baseFilters) ? initialTasks : undefined,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["tasks", viewKey] });
  }

  function reportError(result: { error: string | null }) {
    setMutationError(result.error);
    if (!result.error) invalidate();
  }

  const createMutation = useMutation({
    mutationFn: (title: string) => createTask(supabase, userId, { title, ...taskDefaultsFor(baseFilters) }),
    onSuccess: reportError,
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: (task: TaskRowData) =>
      task.status === "COMPLETED" ? reopenTask(supabase, task.id) : completeTask(supabase, task.id),
    onSuccess: reportError,
  });

  const saveMutation = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: TaskInput }) => updateTask(supabase, taskId, input),
    onSuccess: reportError,
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(supabase, taskId),
    onSuccess: reportError,
  });

  const reorderMutation = useMutation({
    mutationFn: ({ taskId, position }: { taskId: string; position: number }) =>
      updateTaskPosition(supabase, taskId, position),
    onSuccess: reportError,
  });

  function updateUrlFilters(next: UserFilterParams & { projectId?: string }) {
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.priority) params.set("priority", next.priority);
    if (next.search) params.set("q", next.search);
    if (next.sort) params.set("sort", next.sort);
    if (next.projectId) params.set("project", next.projectId);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  const activeEmptyState = hasActiveFilter ? emptyState.filtered : emptyState.default;

  return (
    <div className="space-y-4">
      {mutationError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {mutationError}
        </div>
      )}
      <QuickAdd
        onCreate={async (title) => {
          await createMutation.mutateAsync(title);
        }}
      />
      <TaskFilters
        currentFilters={userFilters}
        onChange={updateUrlFilters}
        projects={projects}
        showProjectFilter={showProjectFilter}
      />
      <TaskList
        tasks={tasks ?? []}
        onOpenTask={setOpenTask}
        onToggleComplete={(task) => toggleCompleteMutation.mutate(task)}
        onReorder={
          enableReorder ? (taskId, position) => reorderMutation.mutate({ taskId, position }) : undefined
        }
        emptyTitle={activeEmptyState.title}
        emptyDescription={activeEmptyState.description}
      />
      {openTask && (
        <TaskDetailPanel
          task={openTask}
          projects={projects}
          open={!!openTask}
          onOpenChange={(open) => !open && setOpenTask(null)}
          onSave={async (taskId, input) => {
            await saveMutation.mutateAsync({ taskId, input });
          }}
          onDelete={(taskId) => {
            deleteMutation.mutate(taskId);
            setOpenTask(null);
          }}
        />
      )}
    </div>
  );
}

function taskDefaultsFor(baseFilters: Omit<ListTasksFilters, "status" | "priority" | "search" | "sort">) {
  const defaults: { projectId?: string; dueDate?: string } = {};
  if (baseFilters.projectId) defaults.projectId = baseFilters.projectId;
  if (baseFilters.dueDate === "today") defaults.dueDate = new Date().toISOString();
  return defaults;
}
