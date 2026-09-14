"use client";
import * as React from "react";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { UserFilterParams } from "@/lib/tasks/filter-params";
import type { Database } from "@/types/database";

type ProjectRowData = Database["flowdo"]["Tables"]["projects"]["Row"];
type LabelRowData = Database["flowdo"]["Tables"]["labels"]["Row"];

const selectClass =
  "h-9 appearance-none rounded-full bg-surface-lowest pl-3.5 pr-8 text-sm text-on-surface shadow-xs outline-none transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60";

function FilterSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={cn(selectClass, className)} />
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-outline" />
    </div>
  );
}

export function TaskFilters({
  currentFilters,
  onChange,
  projects,
  labels = [],
  showProjectFilter = false,
  showLabelFilter = true,
  hideStatusFilter = false,
  hideManualSort = false,
}: {
  currentFilters: UserFilterParams & { projectId?: string };
  onChange: (filters: UserFilterParams & { projectId?: string }) => void;
  projects: ProjectRowData[];
  labels?: LabelRowData[];
  showProjectFilter?: boolean;
  showLabelFilter?: boolean;
  hideStatusFilter?: boolean;
  hideManualSort?: boolean;
}) {
  const [searchValue, setSearchValue] = React.useState(currentFilters.search ?? "");

  React.useEffect(() => {
    setSearchValue(currentFilters.search ?? "");
    // Only re-sync from the parent when the parent's value actually changes
    // (e.g. browser back/forward), not on every local keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilters.search]);

  React.useEffect(() => {
    if (searchValue === (currentFilters.search ?? "")) return;
    const timer = setTimeout(() => {
      onChange({ ...currentFilters, search: searchValue || undefined });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[160px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
        <Input
          placeholder="Search tasks…"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="rounded-xl pl-9"
        />
      </div>

      {!hideStatusFilter && (
        <FilterSelect
          aria-label="Status"
          value={currentFilters.status ?? ""}
          onChange={(e) => onChange({ ...currentFilters, status: (e.target.value || undefined) as UserFilterParams["status"] })}
        >
          <option value="">Any status</option>
          <option value="TODO">To do</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </FilterSelect>
      )}

      <FilterSelect
        aria-label="Priority"
        value={currentFilters.priority ?? ""}
        onChange={(e) => onChange({ ...currentFilters, priority: (e.target.value || undefined) as UserFilterParams["priority"] })}
      >
        <option value="">Any priority</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="URGENT">Urgent</option>
      </FilterSelect>

      {showLabelFilter && (
        <FilterSelect
          aria-label="Label"
          value={currentFilters.labelId ?? ""}
          onChange={(e) => onChange({ ...currentFilters, labelId: e.target.value || undefined })}
        >
          <option value="">Any label</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </FilterSelect>
      )}

      {showProjectFilter && (
        <FilterSelect
          aria-label="Project"
          value={currentFilters.projectId ?? ""}
          onChange={(e) => onChange({ ...currentFilters, projectId: e.target.value || undefined })}
        >
          <option value="">Any project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </FilterSelect>
      )}

      {hideManualSort ? (
        // Completed view: sorting is always by completion date and cannot be
        // changed, so render a disabled control with only that one option
        // instead of a dropdown full of options that silently do nothing.
        <FilterSelect aria-label="Sort" value="completed_at" disabled onChange={() => {}}>
          <option value="completed_at">Completion date</option>
        </FilterSelect>
      ) : (
        <FilterSelect
          aria-label="Sort"
          value={currentFilters.sort ?? "manual"}
          onChange={(e) => onChange({ ...currentFilters, sort: e.target.value as UserFilterParams["sort"] })}
        >
          <option value="manual">Manual order</option>
          <option value="due_date">Due date</option>
          <option value="priority">Priority</option>
          <option value="created_at">Created date</option>
          <option value="alphabetical">Alphabetical</option>
        </FilterSelect>
      )}
    </div>
  );
}
