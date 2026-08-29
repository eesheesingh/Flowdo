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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <NewProjectButton />
      </div>
      {projectsWithCounts.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project to organize your tasks."
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
