import type { SupabaseClient } from "@supabase/supabase-js";

export async function requestPasswordReset(supabase: Pick<SupabaseClient, "auth">, email: string) {
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/reset-password`,
  });
  // Never reveal whether the email exists: always resolve without an error.
  return { error: null };
}

export async function setNewPassword(supabase: Pick<SupabaseClient, "auth">, password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Couldn't update your password. The reset link may have expired." };
  }
  return { error: null };
}
