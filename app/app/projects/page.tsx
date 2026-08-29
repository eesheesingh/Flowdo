import { createClient } from "@/lib/supabase/server";
import { listProjects } from "@/lib/projects/projects";
import { listTasks } from "@/lib/tasks/tasks";
import { ProjectCard } from "@/components/projects/project-card";
import { NewProjectButton } from "./new-project-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FolderKanban } from "lucide-react";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await listProjects(supabase);

  const projectsWithCounts = await Promise.all(
    (projects ?? []).map(async (project) => {
      const { data: tasks } = await listTasks(supabase, { projectId: project.id, excludeCompleted: true });
      return { project, taskCount: tasks?.length ?? 0 };
    })
  );

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
