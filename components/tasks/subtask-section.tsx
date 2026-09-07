"use client";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listSubtasks, createSubtask, subtaskProgress } from "@/lib/tasks/subtasks";
import { completeTask, reopenTask, deleteTask } from "@/lib/tasks/tasks";

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
    <section className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Subtasks</h3>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            {done} / {total} completed
          </span>
        )}
      </div>
      {total > 0 && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      )}
      <ul className="space-y-1">
        {subtasks.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.status === "COMPLETED"}
              onChange={() => toggle.mutate(s)}
              aria-label={s.status === "COMPLETED" ? "Reopen subtask" : "Complete subtask"}
              className="h-4 w-4 rounded border-border"
            />
            <span
              className={
                s.status === "COMPLETED"
                  ? "flex-1 text-sm text-muted-foreground line-through"
                  : "flex-1 text-sm"
              }
            >
              {s.title}
            </span>
            <button
              type="button"
              aria-label="Delete subtask"
              onClick={() => remove.mutate(s.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) add.mutate(title.trim());
        }}
        placeholder="Add a subtask, press Enter…"
        className="w-full rounded-md border border-dashed border-border px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </section>
  );
}
