import type { SupabaseClient } from "@supabase/supabase-js";

export async function logOutUser(supabase: Pick<SupabaseClient, "auth">) {
  await supabase.auth.signOut();
}
