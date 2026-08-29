import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database, "flowdo">;

export interface ProjectInputLike {
  name: string;
  description?: string;
  color: string;
  icon: string;
}

export async function createProject(supabase: Client, ownerId: string, input: ProjectInputLike) {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: ownerId,
      name: input.name,
      description: input.description ?? null,
      color: input.color,
      icon: input.icon,
    })
    .select()
    .single();
  if (error) return { data: null, error: "Couldn't create project. Please try again." };
  return { data, error: null };
}

export async function updateProject(supabase: Client, projectId: string, input: Partial<ProjectInputLike>) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.color !== undefined) patch.color = input.color;
  if (input.icon !== undefined) patch.icon = input.icon;

  const { data, error } = await supabase.from("projects").update(patch).eq("id", projectId).select().single();
  if (error) return { data: null, error: "Couldn't update project. Please try again." };
  return { data, error: null };
}

export async function archiveProject(supabase: Client, projectId: string) {
  const { error } = await supabase.from("projects").update({ status: "ARCHIVED" }).eq("id", projectId);
  if (error) return { error: "Couldn't archive project. Please try again." };
  return { error: null };
}

export async function listProjects(supabase: Client, options: { includeArchived?: boolean } = {}) {
  let query = supabase.from("projects").select("*").order("created_at", { ascending: true });
  if (!options.includeArchived) {
    query = query.eq("status", "ACTIVE");
  }
  const { data, error } = await query;
  if (error) return { data: null, error: "Couldn't load projects. Please try again." };
  return { data, error: null };
}

export async function getProject(supabase: Client, projectId: string) {
  const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (error) return { data: null, error: "Project not found." };
  return { data, error: null };
}
