import Link from "next/link";
import { getProjectIcon } from "@/lib/constants/project-icons";
import type { Database } from "@/types/database";

type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

export function ProjectCard({ project, taskCount }: { project: ProjectRowData; taskCount: number }) {
  const Icon = getProjectIcon(project.icon);

  return (
    <Link
      href={`/app/projects/${project.id}`}
      className="flex flex-col gap-3 rounded-lg border border-border p-4 hover:bg-muted"
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-md"
        style={{ backgroundColor: `${project.color}1A`, color: project.color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium">{project.name}</p>
        <p className="text-sm text-muted-foreground">
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </p>
      </div>
    </Link>
  );
}
