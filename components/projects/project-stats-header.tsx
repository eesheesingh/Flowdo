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
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (circumference * percent) / 100;

  return (
    <div className="rounded-xl bg-surface-lowest p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${project.color}1A`, color: project.color }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: project.color }}>
                List
              </span>
              {project.status === "ARCHIVED" && (
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                  Archived
                </span>
              )}
            </div>
            <h1 className="font-serif text-2xl text-on-surface">{project.name}</h1>
            {project.description && (
              <p className="mt-1 max-w-md text-sm italic text-on-surface-variant">{project.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 self-start rounded-xl bg-surface-container-low px-4 py-2.5 sm:self-auto">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="none" strokeWidth="3.5" className="stroke-surface-highest" />
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="stroke-primary transition-all duration-500"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <span className="absolute text-xs font-semibold text-on-surface">{percent}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-on-surface-variant">Progress</span>
            <span className="text-sm font-medium text-on-surface">
              {total - completed} {total - completed === 1 ? "item" : "items"} left
            </span>
            {overdue > 0 && <span className="text-xs font-medium text-error">{overdue} overdue</span>}
          </div>
        </div>
      </div>
      {actions && <div className="mt-4 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
