import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database, "flowdo">;

export async function listTaskLabels(supabase: Client, taskId: string) {
  const { data, error } = await supabase.from("task_labels").select("label_id").eq("task_id", taskId);
  if (error) return { data: null, error: "Couldn't load task labels. Please try again." };
  return { data: (data ?? []).map((r) => r.label_id), error: null };
}

export async function setTaskLabels(supabase: Client, taskId: string, labelIds: string[]) {
  const { data: current, error: readError } = await supabase
    .from("task_labels")
    .select("label_id")
    .eq("task_id", taskId);
  if (readError) return { error: "Couldn't update task labels. Please try again." };

  const currentIds = new Set((current ?? []).map((r) => r.label_id));
  const nextIds = new Set(labelIds);
  const toAdd = labelIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase.from("task_labels").delete().eq("task_id", taskId).in("label_id", toRemove);
    if (error) return { error: "Couldn't update task labels. Please try again." };
  }
  if (toAdd.length > 0) {
    const { error } = await supabase.from("task_labels").insert(toAdd.map((label_id) => ({ task_id: taskId, label_id })));
    if (error) return { error: "Couldn't update task labels. Please try again." };
  }
  return { error: null };
}
