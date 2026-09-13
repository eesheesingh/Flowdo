import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject, listProjects } from "@/lib/projects/projects";
import { listLabels } from "@/lib/labels/labels";
import { listTasks } from "@/lib/tasks/tasks";
import { listMembers } from "@/lib/projects/members";
import { buildFullFilters } from "@/lib/tasks/filter-params";
import { getTodayRange, isBefore } from "@/lib/tasks/date-ranges";
import { ProjectStatsHeader } from "@/components/projects/project-stats-header";
import { TaskView } from "@/components/tasks/task-view";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { MemberList } from "@/components/projects/member-list";
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

  const baseFilters = { projectId: project.id, parentTaskId: null, excludeCompleted: true } as const;
  const fullFilters = buildFullFilters(baseFilters, searchParams);
  const [{ data: tasks }, { data: allTasksInProject }, { data: projects }, { data: labels }, { data: members }] =
    await Promise.all([
      listTasks(supabase, fullFilters),
      listTasks(supabase, { projectId: project.id, parentTaskId: null }),
      listProjects(supabase),
      listLabels(supabase),
      listMembers(supabase, project.id),
    ]);

  const total = allTasksInProject?.length ?? 0;
  const completed = allTasksInProject?.filter((t) => t.status === "COMPLETED").length ?? 0;
  const { start } = getTodayRange();
  const overdue =
    allTasksInProject?.filter(
      (t) => t.status !== "COMPLETED" && t.due_date && isBefore(t.due_date, start)
    ).length ?? 0;
  const currentUserRole = members?.find((m) => m.user_id === user!.id)?.role ?? "VIEWER";

  return (
    <div className="space-y-6">
      <ProjectStatsHeader
        project={project}
        total={total}
        completed={completed}
        overdue={overdue}
        actions={<ArchiveProjectButton projectId={project.id} isArchived={project.status === "ARCHIVED"} />}
      />
      <MemberList projectId={project.id} initialMembers={members ?? []} currentUserRole={currentUserRole} />
      <TaskView
        initialTasks={tasks ?? []}
        projects={projects ?? []}
        labels={labels ?? []}
        userId={user!.id}
        baseFilters={baseFilters}
        viewKey={`project-${project.id}`}
        emptyState={{
          default: { title: "No tasks in this project yet", description: "Add one above." },
          filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
        }}
        enableReorder
        currentUserRole={currentUserRole}
      />
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <ActivityFeed projectId={project.id} />
      </div>
    </div>
  );
}
