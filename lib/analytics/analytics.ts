import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MinimalTaskRow } from "./aggregate";

type Client = SupabaseClient<Database, "flowdo">;

// Every other lib/ query function in this codebase (listTasks, listProjects,
// listLabels, ...) relies on RLS alone for authorization and never adds a
// redundant client-supplied `.eq("user_id", ...)` on top of it. This matches
// that convention: tasks_select_own is what actually scopes this query to
// the caller's own tasks (and, from Wave E onward, tasks in projects they're
// a member of).
export async function getAnalyticsSnapshot(supabase: Client) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id,status,priority,project_id,due_date,completed_at")
    .is("parent_task_id", null);
  if (error) return { data: null, error: "Couldn't load analytics. Please try again." };
  return { data: data as MinimalTaskRow[], error: null };
}
