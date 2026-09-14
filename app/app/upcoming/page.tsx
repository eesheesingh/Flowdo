import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { listLabels } from "@/lib/labels/labels";
import { buildFullFilters } from "@/lib/tasks/filter-params";
import { UpcomingTaskView } from "./upcoming-task-view";

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseFilters = { dueDate: "upcoming", parentTaskId: null, excludeCompleted: true } as const;
  const fullFilters = buildFullFilters(baseFilters, searchParams);
  const [{ data: tasks }, { data: projects }, { data: labels }] = await Promise.all([
    listTasks(supabase, fullFilters),
    listProjects(supabase),
    listLabels(supabase),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
          Timeline &amp; outlook
        </div>
        <h1 className="font-serif text-3xl text-on-surface tracking-tight">Upcoming</h1>
        <p className="max-w-xl text-on-surface-variant">See what&apos;s ahead and plan your days with peace of mind.</p>
      </header>

      <UpcomingTaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        labels={labels ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
      />
    </div>
  );
}
