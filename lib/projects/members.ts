import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getProject } from "@/lib/projects/projects";

type Client = SupabaseClient<Database, "flowdo">;
type MemberRow = Database["flowdo"]["Tables"]["project_members"]["Row"];
type ProfileRow = Database["flowdo"]["Tables"]["profiles"]["Row"];

export type MemberWithProfile = MemberRow & {
  profile: Pick<ProfileRow, "full_name" | "email" | "avatar_url"> | null;
};

// project_members.user_id and profiles.id both reference auth.users(id), but
// there's no direct foreign key between project_members and profiles for
// PostgREST to auto-embed (`.select("*, profiles(...)")` only works across a
// real FK) -- two queries + an in-memory join instead of a fragile embed
// hint that doesn't actually exist in this schema.
//
// The project owner has no project_members row (tracked solely via
// projects.owner_id -- a deliberate existing invariant, see
// tests/integration/rls.test.ts's "project_members recursion guard" case),
// so it's synthesized here as a virtual OWNER entry alongside the real rows.
export async function listMembers(supabase: Client, projectId: string) {
  const { data: project, error: projectError } = await getProject(supabase, projectId);
  if (!project) return { data: null, error: projectError ?? "Project not found." };

  const { data: members, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) return { data: null, error: "Couldn't load project members. Please try again." };

  const userIds = [project.owner_id, ...members.map((m) => m.user_id)];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", userIds);
  if (profilesError) return { data: null, error: "Couldn't load project members. Please try again." };

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const ownerRow: MemberWithProfile = {
    id: `owner-${project.owner_id}`,
    project_id: projectId,
    user_id: project.owner_id,
    role: "OWNER",
    created_at: project.created_at,
    profile: profileById.get(project.owner_id) ?? null,
  };
  const memberRows: MemberWithProfile[] = members
    .filter((m) => m.user_id !== project.owner_id)
    .map((m) => ({ ...m, profile: profileById.get(m.user_id) ?? null }));

  return { data: [ownerRow, ...memberRows], error: null };
}

export async function inviteMemberByEmail(supabase: Client, projectId: string, email: string, role: MemberRow["role"]) {
  // No invite-token / pending-invite system exists in this schema -- only
  // users who already have a FlowDo account can be added. find_user_id_by_email
  // is a SECURITY DEFINER RPC (migration 0012) that reveals only the
  // matching account's id, not its full profile -- a direct
  // `.from("profiles").select(...).eq("email", ...)` lookup here would be
  // refused by RLS, since the invitee isn't a project mate yet.
  const { data: userId, error: lookupError } = await supabase.rpc("find_user_id_by_email", { _email: email });
  if (lookupError) return { data: null, error: "Couldn't look up that email. Please try again." };
  if (!userId) return { data: null, error: "No FlowDo account found with that email." };

  const { data, error } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, user_id: userId, role })
    .select()
    .single();
  if (error) {
    return {
      data: null,
      error:
        error.code === "23505"
          ? "That person is already a member of this project."
          : "Couldn't add member. Please try again.",
    };
  }
  return { data, error: null };
}

export async function updateMemberRole(supabase: Client, projectId: string, userId: string, role: MemberRow["role"]) {
  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) return { error: "Couldn't update that member's role. Please try again." };
  return { error: null };
}

export async function removeMember(supabase: Client, projectId: string, userId: string) {
  const { error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
  if (error) return { error: "Couldn't remove that member. Please try again." };
  return { error: null };
}
