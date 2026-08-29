import type { SupabaseClient } from "@supabase/supabase-js";

export async function resendConfirmationEmail(supabase: Pick<SupabaseClient, "auth">, email: string) {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    return { error: "Couldn't resend the confirmation email. Please wait a moment and try again." };
  }
  return { error: null };
}
