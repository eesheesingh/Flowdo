import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type ActivityRow = Database["flowdo"]["Tables"]["activity_logs"]["Row"];
type Client = SupabaseClient<Database, "flowdo">;

export async function listActivity(
  supabase: Client,
  opts: { taskId?: string; projectId?: string; limit?: number }
) {
  let query = supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.taskId) query = query.eq("task_id", opts.taskId);
  if (opts.projectId) query = query.eq("project_id", opts.projectId);
  const { data, error } = await query;
  if (error) return { data: null, error: "Couldn't load activity. Please try again." };
  return { data: data as ActivityRow[], error: null };
}
