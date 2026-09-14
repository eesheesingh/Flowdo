import Link from "next/link";
import { getProjectIcon } from "@/lib/constants/project-icons";
import type { Database } from "@/types/database";

type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

export function ProjectCard({ project, taskCount }: { project: ProjectRowData; taskCount: number }) {
  const Icon = getProjectIcon(project.icon);

  return (
    <Link
      href={`/app/projects/${project.id}`}
      className="flex flex-col gap-3 rounded-xl bg-surface-lowest p-4 shadow-xs transition-shadow hover:shadow-sm"
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${project.color}1A`, color: project.color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium text-on-surface">{project.name}</p>
        <p className="text-sm text-on-surface-variant">
          {taskCount} {taskCount === 1 ? "item" : "items"}
        </p>
      </div>
    </Link>
  );
}
