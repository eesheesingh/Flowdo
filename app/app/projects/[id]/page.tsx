import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject, listProjects } from "@/lib/projects/projects";
import { listTasks } from "@/lib/tasks/tasks";
import { buildFullFilters } from "@/lib/tasks/filter-params";
import { ProjectStatsHeader } from "@/components/projects/project-stats-header";
import { TaskView } from "@/components/tasks/task-view";
import { ArchiveProjectButton } from "./archive-project-button";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await getProject(supabase, params.id);
  if (!project) notFound();

  const baseFilters = { projectId: project.id, excludeCompleted: true } as const;
  const fullFilters = buildFullFilters(baseFilters, searchParams);
  const [{ data: tasks }, { data: allTasksInProject }, { data: projects }] = await Promise.all([
    listTasks(supabase, fullFilters),
    listTasks(supabase, { projectId: project.id }),
    listProjects(supabase),
  ]);

  const total = allTasksInProject?.length ?? 0;
  const completed = allTasksInProject?.filter((t) => t.status === "COMPLETED").length ?? 0;
  const overdue =
    allTasksInProject?.filter(
      (t) => t.status !== "COMPLETED" && t.due_date && new Date(t.due_date) < new Date()
    ).length ?? 0;

  return (
    <div className="space-y-6">
      <ProjectStatsHeader
        project={project}
        total={total}
        completed={completed}
        overdue={overdue}
        actions={<ArchiveProjectButton projectId={project.id} isArchived={project.status === "ARCHIVED"} />}
      />
      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey={`project-${project.id}`}
        emptyState={{
          default: { title: "No tasks in this project yet", description: "Add one above." },
          filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        enableReorder
      />
    </div>
  );
}
