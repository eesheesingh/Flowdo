import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { buildFullFilters } from "@/lib/tasks/filter-params";
import { TaskView } from "@/components/tasks/task-view";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseFilters = { projectId: null, excludeCompleted: true } as const;
  const fullFilters = buildFullFilters(baseFilters, searchParams);
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    listTasks(supabase, fullFilters),
    listProjects(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Inbox</h1>
      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey="inbox"
        emptyState={{
          default: { title: "Inbox is empty", description: "Unassigned tasks will land here." },
          filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        enableReorder
      />
    </div>
  );
}
