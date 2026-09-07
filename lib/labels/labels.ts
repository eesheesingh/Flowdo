import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type LabelRow = Database["flowdo"]["Tables"]["labels"]["Row"];
type Client = SupabaseClient<Database, "flowdo">;

export async function listLabels(supabase: Client) {
  const { data, error } = await supabase.from("labels").select("*").order("name", { ascending: true });
  if (error) return { data: null, error: "Couldn't load labels. Please try again." };
  return { data: data as LabelRow[], error: null };
}

export async function createLabel(supabase: Client, userId: string, input: { name: string; color: string }) {
  const { data, error } = await supabase
    .from("labels")
    .insert({ user_id: userId, name: input.name, color: input.color })
    .select()
    .single();
  if (error) {
    return {
      data: null,
      error: error.code === "23505" ? "You already have a label with that name." : "Couldn't create label. Please try again.",
    };
  }
  return { data, error: null };
}

export async function updateLabel(supabase: Client, labelId: string, input: { name?: string; color?: string }) {
  const patch: Database["flowdo"]["Tables"]["labels"]["Update"] = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.color !== undefined) patch.color = input.color;
  const { data, error } = await supabase.from("labels").update(patch).eq("id", labelId).select().single();
  if (error) return { data: null, error: "Couldn't update label. Please try again." };
  return { data, error: null };
}

export async function deleteLabel(supabase: Client, labelId: string) {
  const { error } = await supabase.from("labels").delete().eq("id", labelId);
  if (error) return { error: "Couldn't delete label. Please try again." };
  return { error: null };
}
