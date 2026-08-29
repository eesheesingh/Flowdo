import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { buildFullFilters } from "@/lib/tasks/filter-params";
import { TaskView } from "@/components/tasks/task-view";

export default async function CompletedPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseFilters = { status: "COMPLETED" } as const;
  const fullFilters = buildFullFilters(baseFilters, searchParams);
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    listTasks(supabase, fullFilters),
    listProjects(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Completed</h1>
      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey="completed"
        emptyState={{
          default: { title: "No completed tasks yet", description: "Tasks you finish will show up here." },
          filtered: { title: "No completed tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        showProjectFilter
      />
    </div>
  );
}
