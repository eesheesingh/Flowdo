import type { ListTasksFilters } from "./tasks";

const STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const SORTS = ["due_date", "priority", "created_at", "alphabetical", "manual"] as const;

export type UserFilterParams = Pick<ListTasksFilters, "status" | "priority" | "search" | "sort">;

export function parseFilterParams(params: Record<string, string | string[] | undefined>): UserFilterParams {
  const result: UserFilterParams = {};

  const status = firstValue(params.status);
  if (status && (STATUSES as readonly string[]).includes(status)) {
    result.status = status as UserFilterParams["status"];
  }

  const priority = firstValue(params.priority);
  if (priority && (PRIORITIES as readonly string[]).includes(priority)) {
    result.priority = priority as UserFilterParams["priority"];
  }

  const search = firstValue(params.q);
  if (search) {
    result.search = search;
  }

  const sort = firstValue(params.sort);
  if (sort && (SORTS as readonly string[]).includes(sort)) {
    result.sort = sort as UserFilterParams["sort"];
  }

  return result;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function buildFullFilters<T extends Record<string, unknown>>(
  baseFilters: T,
  rawParams: Record<string, string | string[] | undefined>
): T & UserFilterParams & { projectId?: string } {
  const userFilters = parseFilterParams(rawParams);
  const projectParam = rawParams.project;
  return {
    ...baseFilters,
    ...userFilters,
    ...(typeof projectParam === "string" ? { projectId: projectParam } : {}),
  };
}
