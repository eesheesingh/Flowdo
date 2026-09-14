"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { buildMonthGrid } from "@/lib/calendar/month";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { QuickAdd } from "@/components/tasks/quick-add";
import { Checkbox } from "@/components/ui/checkbox";
import { CreateTaskDialog } from "./create-task-dialog";
import { createClient } from "@/lib/supabase/client";
import { createTask, updateTask, completeTask, reopenTask } from "@/lib/tasks/tasks";
import { setTaskLabels } from "@/lib/tasks/task-labels";
import { cn } from "@/lib/utils";
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(dueDate: string): string {
  const d = new Date(dueDate);
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${h12} ${period}` : `${h12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatDayHeading(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
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
  const [selectedDate, setSelectedDate] = React.useState<string>(() => {
    const today = todayIso();
    const inThisMonth = weeks.some((w) => w.some((c) => c.date === today));
    return inThisMonth ? today : weeks[0]![0]!.date;
  });

  const projectById = new Map(projects.map((p) => [p.id, p]));

  const byDay = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const key = t.due_date.slice(0, 10);
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(t);
  }

  const today = todayIso();
  const selectedTasks = (byDay.get(selectedDate) ?? [])
    .slice()
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  async function toggleComplete(task: TaskRow) {
    if (task.status === "COMPLETED") await reopenTask(supabase, task.id);
    else await completeTask(supabase, task.id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface-lowest p-1 shadow-xs">
          <a
            aria-label="Previous month"
            href={`?month=${shift(year, month, -1)}`}
            onClick={(e) => {
              e.preventDefault();
              router.push(`?month=${shift(year, month, -1)}`);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <ChevronLeft className="h-4 w-4" />
          </a>
          <span className="min-w-[9rem] px-1 text-center font-serif text-lg text-on-surface">
            {MONTHS[month - 1]} {year}
          </span>
          <a
            aria-label="Next month"
            href={`?month=${shift(year, month, 1)}`}
            onClick={(e) => {
              e.preventDefault();
              router.push(`?month=${shift(year, month, 1)}`);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.push(`?month=${today.slice(0, 7)}`);
              setSelectedDate(today);
            }}
            className="rounded-xl bg-surface-lowest px-3 py-1.5 text-sm text-on-surface shadow-xs transition-colors hover:bg-surface-container"
          >
            Today
          </button>
          <div className="flex items-center rounded-xl bg-surface-container-low p-1">
            <span className="rounded-lg bg-surface-lowest px-3 py-1 text-sm font-medium text-primary shadow-xs">Month</span>
            <span
              title="Week view isn't available yet — Month view is the only one wired up for now."
              className="cursor-not-allowed rounded-lg px-3 py-1 text-sm text-on-surface-variant/50"
            >
              Week
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <div className="rounded-xl bg-surface-lowest p-3 shadow-sm lg:col-span-8">
          <div className="grid grid-cols-7 gap-1 pb-2 text-center">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                {d}
              </div>
            ))}
          </div>

          <div role="grid" className="grid grid-cols-1 gap-1.5 md:grid-cols-7">
            {weeks.map((week, wi) => (
              <React.Fragment key={wi}>
                <div role="row" className="contents">
                  {week.map((cell) => {
                    const dayTasks = byDay.get(cell.date) ?? [];
                    const isToday = cell.date === today;
                    const isSelected = cell.date === selectedDate;
                    const dayNumber = Number(cell.date.slice(8, 10));

                    if (!cell.inMonth) {
                      return (
                        <div
                          key={cell.date}
                          role="gridcell"
                          className="hidden min-h-[104px] cursor-default rounded-xl bg-surface-container-low/40 p-2 opacity-40 md:block"
                        >
                          <span className="text-sm text-on-surface-variant">{dayNumber}</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={cell.date}
                        role="gridcell"
                        onClick={() => setSelectedDate(cell.date)}
                        className={cn(
                          "group flex min-h-[104px] cursor-pointer flex-col justify-between rounded-xl p-2 transition-all",
                          isSelected ? "bg-secondary-container/40 shadow-sm" : "bg-surface-container-low hover:bg-surface-container"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          {isToday ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                              {dayNumber}
                            </span>
                          ) : (
                            <span className="text-sm font-medium text-on-surface">{dayNumber}</span>
                          )}
                          <button
                            type="button"
                            aria-label={`Add task on ${cell.date}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreateOn(cell.date);
                            }}
                            className="opacity-0 transition-opacity hover:text-primary focus:opacity-100 group-hover:opacity-100"
                          >
                            <Plus className="h-3.5 w-3.5 text-on-surface-variant" />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          {dayTasks.slice(0, 2).map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenTask(t);
                              }}
                              className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] text-on-surface-variant hover:bg-surface-lowest"
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: t.project_id ? projectById.get(t.project_id)?.color : "currentColor" }}
                              />
                              <span className="truncate">{t.title}</span>
                            </button>
                          ))}
                          {dayTasks.length > 2 && (
                            <span className="px-1 text-[11px] text-on-surface-variant">+{dayTasks.length - 2} more</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl bg-surface-lowest p-4 shadow-sm lg:col-span-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              {selectedDate === today && (
                <span className="mb-1 w-fit rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-primary-fixed">
                  Today
                </span>
              )}
              <h2 className="font-serif text-lg leading-snug text-on-surface">{formatDayHeading(selectedDate)}</h2>
            </div>
            <span className="text-xs text-on-surface-variant">
              {selectedTasks.length} {selectedTasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {selectedTasks.length === 0 && (
              <p className="rounded-lg bg-surface-container-low px-3 py-6 text-center text-sm text-on-surface-variant">
                Nothing scheduled yet.
              </p>
            )}
            {selectedTasks.map((t) => {
              const project = t.project_id ? projectById.get(t.project_id) : undefined;
              const isCompleted = t.status === "COMPLETED";
              return (
                <div
                  key={t.id}
                  className="flex items-start gap-2 rounded-xl p-2 shadow-xs transition-colors hover:bg-surface-container-low"
                >
                  <Checkbox
                    checked={isCompleted}
                    onCheckedChange={() => toggleComplete(t)}
                    aria-label={isCompleted ? "Reopen task" : "Complete task"}
                    className="mt-0.5"
                  />
                  <button type="button" onClick={() => setOpenTask(t)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("truncate text-sm", isCompleted ? "text-on-surface-variant line-through" : "font-medium text-on-surface")}>
                        {t.title}
                      </span>
                      {t.due_date && <span className="shrink-0 font-mono text-xs text-on-surface-variant">{formatTime(t.due_date)}</span>}
                    </div>
                    {project && <span className="mt-0.5 text-[11px] text-on-surface-variant">{project.name}</span>}
                  </button>
                </div>
              );
            })}
          </div>

          <QuickAdd
            placeholder={`Add task for ${formatDayHeading(selectedDate)}...`}
            onCreate={async (title) => {
              await createTask(supabase, userId, { title, dueDate: `${selectedDate}T09:00:00.000Z` });
              router.refresh();
            }}
          />
        </div>
      </div>

      {openTask && (
        <TaskDetailPanel
          task={openTask}
          projects={projects}
          userId={userId}
          open={!!openTask}
          onOpenChange={(o) => !o && setOpenTask(null)}
          onSave={async (taskId, input) => {
            await updateTask(supabase, taskId, input);
            router.refresh();
          }}
          onLabelsChange={async (taskId, ids) => {
            await setTaskLabels(supabase, taskId, ids);
          }}
          onToggleComplete={(t) => toggleComplete(t)}
          onDelete={async () => {
            setOpenTask(null);
            router.refresh();
          }}
        />
      )}
      {createOn && (
        <CreateTaskDialog
          date={createOn}
          userId={userId}
          onOpenChange={() => {
            setCreateOn(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
