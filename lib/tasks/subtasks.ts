import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];
type Client = SupabaseClient<Database, "flowdo">;

export function subtaskProgress(rows: { status: string }[]): { done: number; total: number } {
  return {
    done: rows.filter((r) => r.status === "COMPLETED").length,
    total: rows.length,
  };
}

export async function listSubtasks(supabase: Client, parentId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("parent_task_id", parentId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { data: null, error: "Couldn't load subtasks. Please try again." };
  return { data: data as TaskRow[], error: null };
}

export async function createSubtask(supabase: Client, userId: string, parentId: string, title: string) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, parent_task_id: parentId, title, position: Date.now() })
    .select()
    .single();
  if (error) return { data: null, error: "Couldn't add subtask. Please try again." };
  return { data, error: null };
}
