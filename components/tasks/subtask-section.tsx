"use client";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listSubtasks, createSubtask, subtaskProgress } from "@/lib/tasks/subtasks";
import { completeTask, reopenTask, deleteTask } from "@/lib/tasks/tasks";
import { Checkbox } from "@/components/ui/checkbox";

export function SubtaskSection({ taskId, userId }: { taskId: string; userId: string }) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [title, setTitle] = React.useState("");
  const queryKey = ["subtasks", taskId];

  const { data: subtasks = [] } = useQuery({
    queryKey,
    queryFn: async () => (await listSubtasks(supabase, taskId)).data ?? [],
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  const add = useMutation({
    mutationFn: (t: string) => createSubtask(supabase, userId, taskId, t),
    onSuccess: () => {
      setTitle("");
      invalidate();
    },
  });
  const toggle = useMutation({
    mutationFn: (s: { id: string; status: string }) =>
      s.status === "COMPLETED" ? reopenTask(supabase, s.id) : completeTask(supabase, s.id),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteTask(supabase, id),
    onSuccess: invalidate,
  });

  const { done, total } = subtaskProgress(subtasks);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Subtasks</span>
        {total > 0 && (
          <span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs text-on-secondary-container">
            {done} of {total} done
          </span>
        )}
      </div>
      {total > 0 && (
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-surface-highest"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <ul className="flex flex-col gap-1 pt-1">
        {subtasks.map((s) => (
          <li key={s.id} className="group flex items-center gap-2 rounded-lg bg-surface-container px-2.5 py-1.5">
            <Checkbox
              checked={s.status === "COMPLETED"}
              onCheckedChange={() => toggle.mutate(s)}
              aria-label={s.status === "COMPLETED" ? "Reopen subtask" : "Complete subtask"}
            />
            <span
              className={
                s.status === "COMPLETED"
                  ? "flex-1 text-sm text-on-surface-variant line-through"
                  : "flex-1 text-sm text-on-surface"
              }
            >
              {s.title}
            </span>
            <button
              type="button"
              aria-label="Delete subtask"
              onClick={() => remove.mutate(s.id)}
              className="text-on-surface-variant opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) {
            e.preventDefault(); // input sits inside the detail-panel <form>; don't fire its submit
            add.mutate(title.trim());
          }
        }}
        placeholder="+ Add a subtask..."
        className="w-full rounded-lg bg-surface-container-low px-3 py-1.5 text-sm text-on-surface placeholder:text-outline transition-colors focus-visible:bg-surface-container focus-visible:outline-none"
      />
    </section>
  );
}
