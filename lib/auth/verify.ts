import type { SupabaseClient } from "@supabase/supabase-js";

export async function verifyOtpCode(supabase: Pick<SupabaseClient, "auth">, email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
  if (error) {
    return { error: "That code is incorrect or has expired. Please try again." };
  }
  return { error: null };
}

export async function resendOtpCode(supabase: Pick<SupabaseClient, "auth">, email: string) {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    return { error: "Couldn't resend the code. Please wait a moment and try again." };
  }
  return { error: null };
}
