import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoginInput } from "@/lib/validations/auth";

export async function logInUser(supabase: Pick<SupabaseClient, "auth">, input: LoginInput) {
  const { data, error } = await supabase.auth.signInWithPassword(input);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: null, needsVerification: true };
    }
    return { error: "Incorrect email or password.", needsVerification: false };
  }

  return { error: null, needsVerification: !data.user.email_confirmed_at };
}
