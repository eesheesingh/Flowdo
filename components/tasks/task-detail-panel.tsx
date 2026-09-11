"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { taskSchema, type TaskInput } from "@/lib/validations/tasks";
import { createClient } from "@/lib/supabase/client";
import { listTaskLabels } from "@/lib/tasks/task-labels";
import type { Recurrence, RecurrenceRule } from "@/lib/tasks/recurrence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { SubtaskSection } from "./subtask-section";
import { LabelPicker } from "./label-picker";
import { RecurrenceField } from "./recurrence-field";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];
type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

export function TaskDetailPanel({
  task,
  projects,
  userId,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onLabelsChange,
}: {
  task: TaskRowData;
  projects: ProjectRowData[];
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, input: TaskInput) => Promise<void>;
  onDelete: (taskId: string) => void;
  onLabelsChange?: (taskId: string, labelIds: string[]) => Promise<void>;
}) {
  const [labelIds, setLabelIds] = React.useState<string[]>([]);
  const { data: assignedLabelIds } = useQuery({
    queryKey: ["task-labels", task.id],
    queryFn: async () => (await listTaskLabels(createClient(), task.id)).data ?? [],
  });
  React.useEffect(() => {
    if (assignedLabelIds) setLabelIds(assignedLabelIds);
  }, [assignedLabelIds]);
  const [recurrence, setRecurrence] = React.useState<{ recurrence: Recurrence; rule: RecurrenceRule | null }>({
    recurrence: task.recurrence,
    rule: task.recurrence_rule,
  });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    values: {
      title: task.title,
      description: task.description ?? undefined,
      dueDate: task.due_date ? task.due_date.slice(0, 10) : undefined,
      priority: task.priority,
      projectId: task.project_id ?? undefined,
      recurrence: task.recurrence,
      recurrenceRule: task.recurrence_rule,
    },
  });
  const dueDateValue = watch("dueDate");

  async function onSubmit(values: TaskInput) {
    await onSave(task.id, { ...values, recurrence: recurrence.recurrence, recurrenceRule: recurrence.rule });
    await onLabelsChange?.(task.id, labelIds);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-4 overflow-y-auto bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Task details</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register("title")} />
              <FormError message={errors.title?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                {...register("description")}
                rows={4}
                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  {...register("dueDate", {
                    setValueAs: (value: string) => (value === "" ? null : value),
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  {...register("priority")}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectId">Project</Label>
              <select
                id="projectId"
                {...register("projectId", {
                  setValueAs: (value: string) => (value === "" ? null : value),
                })}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">No project (Inbox)</option>
                {task.project_id && !projects.some((project) => project.id === task.project_id) && (
                  // The task's project isn't in `projects` (listProjects() excludes archived
                  // projects by default), so without this fallback option the select would
                  // silently fall back to "No project (Inbox)" for an archived project's task.
                  // We don't have the archived project's name here, so label it generically.
                  <option value={task.project_id}>Archived project</option>
                )}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <SubtaskSection taskId={task.id} userId={userId} />

            <div className="space-y-2">
              <Label>Labels</Label>
              <LabelPicker userId={userId} value={labelIds} onChange={setLabelIds} />
            </div>

            <RecurrenceField value={recurrence} onChange={setRecurrence} hasDueDate={!!dueDateValue} />

            <div className="mt-auto flex items-center justify-between pt-4">
              <Button type="button" variant="ghost" onClick={() => onDelete(task.id)} className="text-destructive">
                Delete
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
