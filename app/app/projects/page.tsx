import { createClient } from "@/lib/supabase/server";
import { listProjects } from "@/lib/projects/projects";
import { listTasks } from "@/lib/tasks/tasks";
import { ProjectCard } from "@/components/projects/project-card";
import { NewProjectButton } from "./new-project-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FolderKanban } from "lucide-react";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: allTasks }] = await Promise.all([
    listProjects(supabase),
    listTasks(supabase, { excludeCompleted: true }),
  ]);

  const projectsWithCounts = (projects ?? []).map((project) => ({
    project,
    taskCount: (allTasks ?? []).filter((t) => t.project_id === project.id).length,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Organize</span>
          <h1 className="font-serif text-4xl tracking-tight text-on-surface sm:text-5xl">Lists</h1>
        </div>
        <NewProjectButton />
      </header>
      {projectsWithCounts.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No lists yet"
          description="Create a list to keep related tasks together."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projectsWithCounts.map(({ project, taskCount }) => (
            <ProjectCard key={project.id} project={project} taskCount={taskCount} />
          ))}
        </div>
      )}
    </div>
  );
}
