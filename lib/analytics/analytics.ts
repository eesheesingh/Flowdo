import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MinimalTaskRow } from "./aggregate";

type Client = SupabaseClient<Database, "flowdo">;

// Deviation from this codebase's usual convention (listTasks, listProjects,
// listLabels, ... rely on RLS alone and never add a redundant client-supplied
// `.eq("user_id", ...)`): after migrations 0012+0014, tasks_select_own also
// returns tasks from OTHER members' projects the caller belongs to -- correct
// for task-list views, but wrong here, since /app/analytics is framed as "my
// own productivity," a single-user view with no team framing. The explicit
// filter below is a *scoping* filter (what this page means), not an
// authorization filter (RLS still governs access regardless of this query).
export async function getAnalyticsSnapshot(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id,status,priority,project_id,due_date,completed_at")
    .eq("user_id", userId)
    .is("parent_task_id", null)
    // ponytail: PostgREST's default max-rows is 1000; an unbounded select
    // would silently truncate past that with no error, corrupting the
    // counts below. 1000 is fine for one person's task history -- revisit
    // if this page ever becomes project-wide.
    .limit(1000);
  if (error) return { data: null, error: "Couldn't load analytics. Please try again." };
  return { data: data as MinimalTaskRow[], error: null };
}
