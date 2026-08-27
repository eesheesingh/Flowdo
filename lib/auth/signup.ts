import type { SupabaseClient } from "@supabase/supabase-js";
import type { SignupInput } from "@/lib/validations/auth";

export async function signUpUser(supabase: Pick<SupabaseClient, "auth">, input: SignupInput) {
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName } },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "An account with this email already exists." };
    }
    return { error: "Something went wrong creating your account. Please try again." };
  }

  return { error: null };
}
