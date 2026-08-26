import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnonClient } from "./admin-client";

export async function createConfirmedTestUser(
  admin: SupabaseClient,
  email: string,
  password: string
) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`failed to create test user: ${error?.message}`);
  }

  const client = createAnonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`failed to sign in test user: ${signInError.message}`);
  }

  return { userId: data.user.id, client };
}
