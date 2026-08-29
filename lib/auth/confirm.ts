import type { SupabaseClient } from "@supabase/supabase-js";

export async function confirmEmailToken(
  supabase: Pick<SupabaseClient, "auth">,
  params: { tokenHash: string; type: "signup" | "recovery" }
) {
  const { error } = await supabase.auth.verifyOtp({ token_hash: params.tokenHash, type: params.type });
  if (error) {
    return { error: "This link is invalid or has expired." };
  }
  return { error: null };
}
