import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { listLabels } from "@/lib/labels/labels";
import { buildFullFilters } from "@/lib/tasks/filter-params";
import { TaskView } from "@/components/tasks/task-view";

// ponytail: greeting/hour use UTC (no per-user timezone stored on profiles),
// so it can be off by a few hours for some users. Add profiles.timezone and
// pass it through here if that precision starts to matter.
function greeting(now: Date): string {
  const hour = now.getUTCHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseFilters = { dueDate: "today", parentTaskId: null, excludeCompleted: true } as const;
  const fullFilters = buildFullFilters(baseFilters, searchParams);
  const [{ data: tasks }, { data: projects }, { data: labels }, { data: profile }, { data: allTodayTasks }] =
    await Promise.all([
      listTasks(supabase, fullFilters),
      listProjects(supabase),
      listLabels(supabase),
      supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
      listTasks(supabase, { dueDate: "today", parentTaskId: null }),
    ]);

  const name = profile?.full_name?.split(" ")[0] || user!.email!.split("@")[0];
  const now = new Date();
  const total = allTodayTasks?.length ?? 0;
  const completed = allTodayTasks?.filter((t) => t.status === "COMPLETED").length ?? 0;
  const pct = total === 0 ? 0 : completed / total;
  const circumference = 2 * Math.PI * 15.915; // matches the SVG path's radius below

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      <div
        className="pointer-events-none absolute -left-10 -top-16 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-10 right-0 h-64 w-64 rounded-full bg-tertiary-container/15 blur-3xl"
        aria-hidden="true"
      />
      <header className="relative flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {total > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {total} {total === 1 ? "task" : "tasks"} today
              </span>
            )}
          </div>
          <h1 className="font-serif text-4xl tracking-tight text-on-surface sm:text-5xl">
            {greeting(now)}, {name}
          </h1>
          <p className="max-w-xl text-on-surface-variant">
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}.{" "}
            Focus on one quiet intention at a time.
          </p>
        </div>

        {total > 0 && (
          <div className="flex items-center gap-3 self-start rounded-xl bg-surface-lowest p-3 shadow-sm md:self-auto">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  className="stroke-surface-container"
                  strokeWidth="3.5"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  className="stroke-primary-container"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${pct * circumference}, ${circumference}`}
                />
              </svg>
              <span className="absolute text-xs font-medium text-on-surface">
                {completed}/{total}
              </span>
            </div>
            <div className="pr-1">
              <div className="text-sm font-medium text-on-surface">Daily balance</div>
              <div className="text-xs text-on-surface-variant">{completed} done so far</div>
            </div>
          </div>
        )}
      </header>

      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        labels={labels ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey="today"
        emptyState={{
          default: { title: "Nothing due today", description: "Tasks due today will show up here." },
          filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        enableReorder
        showProjectFilter
      />
    </div>
  );
}
