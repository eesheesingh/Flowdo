"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { NotebookPen, ChevronDown } from "lucide-react";
import { taskSchema, type TaskInput } from "@/lib/validations/tasks";
import { createClient } from "@/lib/supabase/client";
import { listTaskLabels } from "@/lib/tasks/task-labels";
import type { Recurrence, RecurrenceRule } from "@/lib/tasks/recurrence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError } from "@/components/ui/form-error";
import { Sheet, SheetContent, SheetTitle, SheetCloseButton } from "@/components/ui/sheet";
import { SubtaskSection } from "./subtask-section";
import { LabelPicker } from "./label-picker";
import { RecurrenceField } from "./recurrence-field";
import { ActivityFeed } from "./activity-feed";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];
type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

const selectClass =
  "flex h-9 w-full appearance-none rounded-lg bg-surface-lowest px-2.5 pr-8 text-sm text-on-surface outline-none transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50";

export function TaskDetailPanel({
  task,
  projects,
  userId,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onLabelsChange,
  onToggleComplete,
  readOnly = false,
}: {
  task: TaskRowData;
  projects: ProjectRowData[];
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, input: TaskInput) => Promise<void>;
  onDelete: (taskId: string) => void;
  onLabelsChange?: (taskId: string, labelIds: string[]) => Promise<void>;
  onToggleComplete?: (task: TaskRowData) => void;
  readOnly?: boolean;
}) {
  const isCompleted = task.status === "COMPLETED";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[620px]">
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-primary-container via-primary to-secondary-container" />
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <fieldset disabled={readOnly} className="contents">
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 items-start gap-3">
                  <Checkbox
                    checked={isCompleted}
                    onCheckedChange={() => onToggleComplete?.(task)}
                    aria-label={isCompleted ? "Reopen task" : "Complete task"}
                    className="mt-2 h-5 w-5"
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    <SheetTitle className="sr-only">Task details</SheetTitle>
                    <Label htmlFor="title" className="sr-only">
                      Title
                    </Label>
                    <input
                      id="title"
                      {...register("title")}
                      className="w-full rounded-md bg-transparent px-1 font-serif text-2xl tracking-tight text-on-surface transition-colors placeholder:text-outline focus:bg-surface-container-low focus:outline-none"
                    />
                    <FormError message={errors.title?.message} />
                  </div>
                </div>
                <SheetCloseButton />
              </div>

              <div className="rounded-xl bg-surface-container-low p-4">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-on-surface-variant">
                  <NotebookPen className="h-4 w-4" /> Notes
                </span>
                <Textarea
                  id="description"
                  {...register("description")}
                  rows={3}
                  placeholder="Add notes or details..."
                  className="border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 rounded-xl bg-surface-container p-3">
                    <Label htmlFor="dueDate" className="text-sm text-on-surface-variant">
                      Due date
                    </Label>
                    <Input
                      id="dueDate"
                      type="date"
                      {...register("dueDate", {
                        setValueAs: (value: string) => (value === "" ? null : value),
                      })}
                      className="bg-surface-lowest"
                    />
                  </div>
                  <div className="space-y-1.5 rounded-xl bg-surface-container p-3">
                    <Label htmlFor="priority" className="text-sm text-on-surface-variant">
                      Priority
                    </Label>
                    <div className="relative">
                      <select id="priority" {...register("priority")} className={selectClass}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-outline" />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-surface-container p-3">
                  <RecurrenceField value={recurrence} onChange={setRecurrence} hasDueDate={!!dueDateValue} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="projectId" className="text-sm font-medium text-on-surface-variant">
                  List
                </Label>
                <div className="relative">
                  <select
                    id="projectId"
                    {...register("projectId", {
                      setValueAs: (value: string) => (value === "" ? null : value),
                    })}
                    className={selectClass + " bg-surface-container-low hover:bg-surface-container"}
                  >
                    <option value="">No list (Inbox)</option>
                    {task.project_id && !projects.some((project) => project.id === task.project_id) && (
                      // The task's project isn't in `projects` (listProjects() excludes archived
                      // projects by default), so without this fallback option the select would
                      // silently fall back to "No list (Inbox)" for an archived project's task.
                      // We don't have the archived project's name here, so label it generically.
                      <option value={task.project_id}>Archived list</option>
                    )}
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-outline" />
                </div>
              </div>

              <SubtaskSection taskId={task.id} userId={userId} />

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-on-surface-variant">Labels</Label>
                <LabelPicker userId={userId} value={labelIds} onChange={setLabelIds} />
              </div>

              <ActivityFeed taskId={task.id} />
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 bg-surface-lowest px-6 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
              <Button type="button" variant="ghost" onClick={() => onDelete(task.id)} className="text-error hover:bg-error-container hover:text-on-error-container">
                Delete task
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving…" : "Done"}
                </Button>
              </div>
            </div>
          </fieldset>
        </form>
      </SheetContent>
    </Sheet>
  );
}
