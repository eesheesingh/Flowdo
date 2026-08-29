import * as React from "react";
import { getProjectIcon } from "@/lib/constants/project-icons";
import type { Database } from "@/types/database";

type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

export function ProjectStatsHeader({
  project,
  total,
  completed,
  overdue,
  actions,
}: {
  project: ProjectRowData;
  total: number;
  completed: number;
  overdue: number;
  actions?: React.ReactNode;
}) {
  const Icon = getProjectIcon(project.icon);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ backgroundColor: `${project.color}1A`, color: project.color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <h1 className="text-xl font-semibold">{project.name}</h1>
        {project.status === "ARCHIVED" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Archived
          </span>
        )}
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
      <div className="flex gap-6 text-sm text-muted-foreground">
        <span>{total} total</span>
        <span>{completed} completed</span>
        {overdue > 0 && <span className="text-destructive">{overdue} overdue</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
