import { notFound } from "next/navigation";
import Link from "next/link";
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
  const [{ data: tasks }, { data: allTasksInProject }, { data: projects }, { data: labels }, { data: members }, { data: otherActiveTasks }] =
    await Promise.all([
      listTasks(supabase, fullFilters),
      listTasks(supabase, { projectId: project.id, parentTaskId: null }),
      listProjects(supabase),
      listLabels(supabase),
      listMembers(supabase, project.id),
      // One broad fetch, grouped in memory below, so the "other lists" panel
      // can show a real item count per list without a query per list.
      listTasks(supabase, { parentTaskId: null, excludeCompleted: true }),
    ]);

  const total = allTasksInProject?.length ?? 0;
  const completed = allTasksInProject?.filter((t) => t.status === "COMPLETED").length ?? 0;
  const { start } = getTodayRange();
  const overdue =
    allTasksInProject?.filter(
      (t) => t.status !== "COMPLETED" && t.due_date && isBefore(t.due_date, start)
    ).length ?? 0;
  const currentUserRole = members?.find((m) => m.user_id === user!.id)?.role ?? "VIEWER";

  const countByProject = new Map<string, number>();
  for (const t of otherActiveTasks ?? []) {
    if (t.project_id) countByProject.set(t.project_id, (countByProject.get(t.project_id) ?? 0) + 1);
  }
  const otherProjects = (projects ?? []).filter((p) => p.id !== project.id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-12">
      <ProjectStatsHeader
        project={project}
        total={total}
        completed={completed}
        overdue={overdue}
        actions={<ArchiveProjectButton projectId={project.id} isArchived={project.status === "ARCHIVED"} />}
      />
      <MemberList projectId={project.id} initialMembers={members ?? []} currentUserRole={currentUserRole} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TaskView
            initialTasks={tasks ?? []}
            projects={projects ?? []}
            labels={labels ?? []}
            userId={user!.id}
            baseFilters={baseFilters}
            viewKey={`project-${project.id}`}
            emptyState={{
              default: { title: "No items in this list yet", description: "Add one above." },
              filtered: { title: "No tasks match your filters", description: "Try clearing a filter or search term." },
            }}
            enableReorder
            currentUserRole={currentUserRole}
          />
        </div>

        {otherProjects.length > 0 && (
          <div className="lg:col-span-4">
            <div className="rounded-xl bg-surface-lowest p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-serif text-lg text-on-surface">Other lists</span>
                <span className="text-xs text-on-surface-variant">{otherProjects.length} active</span>
              </div>
              <div className="flex flex-col gap-1">
                {otherProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/app/projects/${p.id}`}
                    className="group flex items-center justify-between rounded-lg p-2.5 transition-colors hover:bg-surface-container-low"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="truncate text-sm font-medium text-on-surface transition-colors group-hover:text-primary">
                        {p.name}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">
                      {countByProject.get(p.id) ?? 0}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <ActivityFeed projectId={project.id} />
    </div>
  );
}
