"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { buildMonthGrid } from "@/lib/calendar/month";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { CreateTaskDialog } from "./create-task-dialog";
import { createClient } from "@/lib/supabase/client";
import { updateTask } from "@/lib/tasks/tasks";
import { setTaskLabels } from "@/lib/tasks/task-labels";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];
type ProjectRow = Database["flowdo"]["Tables"]["projects"]["Row"];
type LabelRow = Database["flowdo"]["Tables"]["labels"]["Row"];

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function shift(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthGrid({
  year, month, tasks, projects, labels: _labels, userId,
}: {
  year: number; month: number;
  tasks: TaskRow[]; projects: ProjectRow[]; labels: LabelRow[]; userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const weeks = buildMonthGrid(year, month);
  const [openTask, setOpenTask] = React.useState<TaskRow | null>(null);
  const [createOn, setCreateOn] = React.useState<string | null>(null);

  const byDay = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const key = t.due_date.slice(0, 10);
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(t);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{MONTHS[month - 1]} {year}</h2>
        <div className="flex gap-1">
          <a aria-label="Previous month" href={`?month=${shift(year, month, -1)}`}
             onClick={(e) => { e.preventDefault(); router.push(`?month=${shift(year, month, -1)}`); }}
             className="rounded-md border border-border p-1"><ChevronLeft className="h-4 w-4" /></a>
          <a aria-label="Next month" href={`?month=${shift(year, month, 1)}`}
             onClick={(e) => { e.preventDefault(); router.push(`?month=${shift(year, month, 1)}`); }}
             className="rounded-md border border-border p-1"><ChevronRight className="h-4 w-4" /></a>
        </div>
      </div>

      <div className="hidden grid-cols-7 gap-px text-xs text-muted-foreground md:grid">
        {WEEKDAYS.map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
      </div>

      <div role="grid" className="grid grid-cols-1 gap-px md:grid-cols-7">
        {weeks.map((week, wi) => (
          <React.Fragment key={wi}>
            <div role="row" className="contents">
              {week.map((cell) => {
                const dayTasks = byDay.get(cell.date) ?? [];
                if (!cell.inMonth && dayTasks.length === 0) {
                  return <div key={cell.date} role="gridcell" className="hidden min-h-24 border border-border bg-muted/30 md:block" />;
                }
                return (
                  <div key={cell.date} role="gridcell"
                       className={"group min-h-24 border border-border p-1 " + (cell.inMonth ? "" : "bg-muted/30")}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{Number(cell.date.slice(8, 10))}</span>
                      <button type="button" aria-label={`Add task on ${cell.date}`}
                              onClick={() => setCreateOn(cell.date)}
                              className="opacity-0 focus:opacity-100 group-hover:opacity-100">
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <ul className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((t) => (
                        <li key={t.id}>
                          <button type="button" onClick={() => setOpenTask(t)}
                                  className="flex w-full items-center gap-1 truncate rounded px-1 text-left text-xs hover:bg-muted">
                            <span className={"h-1.5 w-1.5 shrink-0 rounded-full " +
                              (t.priority === "URGENT" ? "bg-destructive" : t.priority === "HIGH" ? "bg-orange-500" : "bg-muted-foreground")} />
                            <span className="truncate">{t.title}</span>
                          </button>
                        </li>
                      ))}
                      {dayTasks.length > 3 && (
                        <li className="px-1 text-xs text-muted-foreground">+{dayTasks.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>

      {openTask && (
        <TaskDetailPanel
          task={openTask}
          projects={projects}
          userId={userId}
          open={!!openTask}
          onOpenChange={(o) => !o && setOpenTask(null)}
          onSave={async (taskId, input) => { await updateTask(supabase, taskId, input); router.refresh(); }}
          onLabelsChange={async (taskId, ids) => { await setTaskLabels(supabase, taskId, ids); }}
          onDelete={async () => { setOpenTask(null); router.refresh(); }}
        />
      )}
      {createOn && <CreateTaskDialog date={createOn} userId={userId} onOpenChange={() => { setCreateOn(null); router.refresh(); }} />}
    </div>
  );
}
