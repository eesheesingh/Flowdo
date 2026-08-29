"use client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { UserFilterParams } from "@/lib/tasks/filter-params";
import type { Database } from "@/types/database";

type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];

export function TaskFilters({
  currentFilters,
  onChange,
  projects,
  showProjectFilter = false,
}: {
  currentFilters: UserFilterParams & { projectId?: string };
  onChange: (filters: UserFilterParams & { projectId?: string }) => void;
  projects: ProjectRowData[];
  showProjectFilter?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[160px]">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks…"
          defaultValue={currentFilters.search ?? ""}
          onChange={(e) => onChange({ ...currentFilters, search: e.target.value || undefined })}
          className="pl-8"
        />
      </div>

      <select
        aria-label="Status"
        value={currentFilters.status ?? ""}
        onChange={(e) => onChange({ ...currentFilters, status: (e.target.value || undefined) as UserFilterParams["status"] })}
        className="h-10 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">Any status</option>
        <option value="TODO">To do</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

      <select
        aria-label="Priority"
        value={currentFilters.priority ?? ""}
        onChange={(e) => onChange({ ...currentFilters, priority: (e.target.value || undefined) as UserFilterParams["priority"] })}
        className="h-10 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">Any priority</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="URGENT">Urgent</option>
      </select>

      {showProjectFilter && (
        <select
          aria-label="Project"
          value={currentFilters.projectId ?? ""}
          onChange={(e) => onChange({ ...currentFilters, projectId: e.target.value || undefined })}
          className="h-10 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Any project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      )}

      <select
        aria-label="Sort"
        value={currentFilters.sort ?? "manual"}
        onChange={(e) => onChange({ ...currentFilters, sort: e.target.value as UserFilterParams["sort"] })}
        className="h-10 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="manual">Manual order</option>
        <option value="due_date">Due date</option>
        <option value="priority">Priority</option>
        <option value="created_at">Created date</option>
        <option value="alphabetical">Alphabetical</option>
      </select>
    </div>
  );
}
