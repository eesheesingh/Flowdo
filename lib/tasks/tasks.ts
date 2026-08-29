import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getTodayRange } from "./date-ranges";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];
type TaskStatus = TaskRow["status"];
type TaskPriority = TaskRow["priority"];
type Client = SupabaseClient<Database, "flowdo">;

export interface TaskInputLike {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: TaskPriority;
  projectId?: string;
}

export async function createTask(supabase: Client, userId: string, input: TaskInputLike) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      due_date: input.dueDate ?? null,
      priority: input.priority ?? "MEDIUM",
      project_id: input.projectId ?? null,
    })
    .select()
    .single();

  if (error) return { data: null, error: "Couldn't create task. Please try again." };
  return { data, error: null };
}

export async function updateTask(
  supabase: Client,
  taskId: string,
  input: Partial<TaskInputLike> & { status?: TaskStatus }
) {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.projectId !== undefined) patch.project_id = input.projectId;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await supabase.from("tasks").update(patch).eq("id", taskId).select().single();
  if (error) return { data: null, error: "Couldn't update task. Please try again." };
  return { data, error: null };
}

export async function deleteTask(supabase: Client, taskId: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: "Couldn't delete task. Please try again." };
  return { error: null };
}

export async function completeTask(supabase: Client, taskId: string) {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) return { error: "Couldn't complete task. Please try again." };
  return { error: null };
}

export async function reopenTask(supabase: Client, taskId: string) {
  const { error } = await supabase.from("tasks").update({ status: "TODO", completed_at: null }).eq("id", taskId);
  if (error) return { error: "Couldn't reopen task. Please try again." };
  return { error: null };
}

export async function updateTaskPosition(supabase: Client, taskId: string, position: number) {
  const { error } = await supabase.from("tasks").update({ position }).eq("id", taskId);
  if (error) return { error: "Couldn't reorder task. Please try again." };
  return { error: null };
}

export interface ListTasksFilters {
  projectId?: string | null;
  dueDate?: "today" | "upcoming" | "none";
  excludeCompleted?: boolean;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  sort?: "due_date" | "priority" | "created_at" | "alphabetical" | "manual";
}

export async function listTasks(supabase: Client, filters: ListTasksFilters) {
  let query = supabase.from("tasks").select("*");

  if (filters.projectId !== undefined) {
    query = filters.projectId === null ? query.is("project_id", null) : query.eq("project_id", filters.projectId);
  }

  if (filters.dueDate === "today") {
    const { start, end } = getTodayRange();
    query = query.gte("due_date", start).lt("due_date", end);
  } else if (filters.dueDate === "upcoming") {
    const { end } = getTodayRange();
    query = query.gte("due_date", end);
  } else if (filters.dueDate === "none") {
    query = query.is("due_date", null);
  }

  if (filters.excludeCompleted) {
    query = query.neq("status", "COMPLETED");
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters.search) {
    // Commas would break PostgREST's or() filter-string syntax; strip them.
    // A literal "%" in the search term just becomes an (harmless) extra
    // ilike wildcard, not a security concern - PostgREST parameterizes values.
    const safeSearch = filters.search.replace(/,/g, "");
    query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
  }

  // Postgres enums sort by declaration order, so priority ascending/descending
  // is meaningful: flowdo.task_priority is declared LOW, MEDIUM, HIGH, URGENT.
  switch (filters.sort) {
    case "priority":
      query = query.order("priority", { ascending: false });
      break;
    case "alphabetical":
      query = query.order("title", { ascending: true });
      break;
    case "created_at":
      query = query.order("created_at", { ascending: false });
      break;
    case "due_date":
      query = query.order("due_date", { ascending: true, nullsFirst: false });
      break;
    default:
      query = query.order("position", { ascending: true });
  }

  const { data, error } = await query;
  if (error) return { data: null, error: "Couldn't load tasks. Please try again." };
  return { data: data as TaskRow[], error: null };
}
