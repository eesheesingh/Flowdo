import Link from "next/link";
import { Sparkles, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { listLabels } from "@/lib/labels/labels";
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

  const baseFilters = { projectId: null, parentTaskId: null, excludeCompleted: true } as const;
  const fullFilters = buildFullFilters(baseFilters, searchParams);
  const [{ data: tasks }, { data: projects }, { data: labels }, { data: activeTasks }, { data: recentlyProcessed }] =
    await Promise.all([
      listTasks(supabase, fullFilters),
      listProjects(supabase),
      listLabels(supabase),
      // One broad fetch, grouped in memory below, instead of one count query per list.
      listTasks(supabase, { parentTaskId: null, excludeCompleted: true }),
      listTasks(supabase, {
        status: "COMPLETED",
        projectId: null,
        parentTaskId: null,
        sort: "completed_at",
        limit: 3,
      }),
    ]);

  const countByProject = new Map<string, number>();
  for (const t of activeTasks ?? []) {
    if (!t.project_id) continue;
    countByProject.set(t.project_id, (countByProject.get(t.project_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-12">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <span>Triage &amp; Reflection</span>
        </div>
        <h1 className="font-serif text-3xl text-on-surface">Inbox</h1>
        <p className="max-w-xl text-on-surface-variant">
          Everything you&apos;ve quietly captured, waiting for a calm moment to organize.
        </p>
        <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-lowest px-3 py-1 text-sm text-on-surface shadow-xs">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {(tasks ?? []).length} {(tasks ?? []).length === 1 ? "item" : "items"} waiting
        </span>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TaskView
            initialTasks={tasks ?? []}
            projects={projects ?? []}
            labels={labels ?? []}
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

        <div className="flex flex-col gap-4 lg:col-span-4">
          <div className="rounded-xl bg-surface-lowest p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-tertiary" />
              <h3 className="text-sm font-medium text-on-surface">Organizing tip</h3>
            </div>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Keep your inbox light. Assign a due date, or move items into a list, to clear cognitive space.
            </p>
          </div>

          {(projects ?? []).length > 0 && (
            <div className="rounded-xl bg-surface-lowest p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-medium text-on-surface">Your lists</h3>
              <div className="grid grid-cols-2 gap-2">
                {(projects ?? []).map((project) => (
                  <Link
                    key={project.id}
                    href={`/app/projects/${project.id}`}
                    className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-2.5 transition-colors hover:bg-surface-container"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                      <span className="truncate text-sm font-medium text-on-surface">{project.name}</span>
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {countByProject.get(project.id) ?? 0} items
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(recentlyProcessed ?? []).length > 0 && (
            <div className="rounded-xl bg-surface-lowest p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium text-on-surface">Recently processed</h3>
              </div>
              <ul className="flex flex-col gap-1.5">
                {(recentlyProcessed ?? []).map((t) => (
                  <li key={t.id} className="truncate rounded-lg bg-surface-container-low/60 px-2.5 py-1.5 text-sm text-on-surface-variant">
                    {t.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
