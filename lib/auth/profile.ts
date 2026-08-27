import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function updateProfile(
  supabase: SupabaseClient<Database, "flowdo">,
  userId: string,
  input: { fullName: string }
) {
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName })
    .eq("id", userId);

  if (error) {
    return { error: "Couldn't update your profile. Please try again." };
  }
  return { error: null };
}
