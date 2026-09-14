import { Sparkles, Flame, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listTasks, getCompletionStreak } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { listLabels } from "@/lib/labels/labels";
import { buildFullFilters } from "@/lib/tasks/filter-params";
import { TaskView } from "@/components/tasks/task-view";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];

// completed_at is a UTC timestamp; slicing to the date portion avoids the
// SSR/client hydration mismatch that toLocaleDateString-based day math risks
// (see the identical convention in components/tasks/task-row.tsx).
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(iso: string, now: Date): string {
  const key = dayKey(iso);
  const todayKey = dayKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (key === todayKey) return "Today";
  if (key === dayKey(yesterday.toISOString())) return "Yesterday";
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function last7DayCounts(tasks: TaskRow[], now: Date): number[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (!t.completed_at) continue;
    const key = dayKey(t.completed_at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const days: number[] = [];
  const cursor = new Date(now);
  cursor.setUTCDate(cursor.getUTCDate() - 6);
  for (let i = 0; i < 7; i++) {
    days.push(counts.get(dayKey(cursor.toISOString())) ?? 0);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export default async function CompletedPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseFilters = { status: "COMPLETED", parentTaskId: null, sort: "completed_at" } as const;
  const fullFilters = buildFullFilters(baseFilters, searchParams);
  const [{ data: tasks }, { data: projects }, { data: labels }, { data: allCompleted }, streak] = await Promise.all([
    listTasks(supabase, fullFilters),
    listProjects(supabase),
    listLabels(supabase),
    // Unfiltered, for the achievement banner -- the filtered `tasks` above
    // shouldn't make the "128 tasks completed" headline shrink when someone
    // narrows the list below.
    listTasks(supabase, { status: "COMPLETED", parentTaskId: null, sort: "completed_at", limit: 500 }),
    getCompletionStreak(supabase, user!.id),
  ]);

  const now = new Date();
  const totalCompleted = allCompleted?.length ?? 0;
  const sparkline = last7DayCounts(allCompleted ?? [], now);
  const sparkMax = Math.max(1, ...sparkline);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-12">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-on-surface">Completed</h1>
          <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs text-on-surface-variant">
            Archive
          </span>
        </div>
        <p className="text-on-surface-variant">Nice work. Everything you&apos;ve accomplished.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface-lowest p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-container text-primary">
              <CheckCircle2 className="h-[18px] w-[18px]" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-medium text-on-surface">{totalCompleted}</span>
              <span className="text-xs text-on-surface-variant">Tasks completed</span>
            </div>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed">
                <Flame className="h-[18px] w-[18px]" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-medium text-on-surface">{streak}-day</span>
                <span className="text-xs text-on-surface-variant">Unbroken streak</span>
              </div>
            </div>
          )}
          <div className="hidden items-center gap-1.5 text-sm text-on-surface-variant sm:flex">
            <Sparkles className="h-4 w-4 text-primary" />
            Clean mind, steady momentum
          </div>
        </div>
        <div className="flex items-end gap-1" aria-label="Tasks completed per day, last 7 days" role="img">
          {sparkline.map((count, i) => (
            <div
              key={i}
              className="w-2 rounded-sm bg-primary/70"
              style={{ height: `${4 + (count / sparkMax) * 20}px` }}
            />
          ))}
        </div>
      </div>

      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        labels={labels ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey="completed"
        emptyState={{
          default: { title: "No completed tasks yet", description: "Tasks you finish will show up here." },
          filtered: { title: "No completed tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        showProjectFilter
        hideStatusFilter
        hideManualSort
        groupBy={(task) => dayLabel(task.completed_at!, now)}
      />
    </div>
  );
}
