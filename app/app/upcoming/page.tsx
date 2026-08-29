import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { buildFullFilters } from "@/lib/tasks/filter-params";
import { TaskView } from "@/components/tasks/task-view";

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseFilters = { dueDate: "upcoming", excludeCompleted: true } as const;
  const fullFilters = buildFullFilters(baseFilters, searchParams);
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    listTasks(supabase, fullFilters),
    listProjects(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Upcoming</h1>
      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey="upcoming"
        emptyState={{
          default: { title: "No upcoming tasks", description: "Tasks due soon will show up here." },
          filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        enableReorder
        showProjectFilter
      />
    </div>
  );
}
