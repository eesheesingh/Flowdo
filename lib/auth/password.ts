import type { SupabaseClient } from "@supabase/supabase-js";

export async function requestPasswordReset(supabase: Pick<SupabaseClient, "auth">, email: string) {
  // Always called from a Client Component's onSubmit handler (never during
  // SSR), so window is guaranteed to exist here. This is deliberately NOT a
  // NEXT_PUBLIC_SITE_URL env var: that value is easy to leave unset (it was,
  // in an earlier version of this function — the redirect silently degraded
  // to a relative path, which Supabase's redirect-URL allow-list rejects,
  // falling back to site_url and breaking the whole reset flow) and would
  // drift from reality across dev/staging/prod. Deriving it from the actual
  // page origin always matches wherever the app is actually being served.
  //
  // NOTE: this `redirectTo` value is currently inert for the actual emailed
  // link. The custom recovery.html template's link is built entirely from
  // `{{ .SiteURL }}/auth/confirm?...&next=/reset-password` and never
  // references `{{ .RedirectTo }}` (or `{{ .ConfirmationURL }}`), so nothing
  // here currently controls where the recovery email points. Left in place
  // as harmless — it'll matter again if a future template change
  // reintroduces `{{ .RedirectTo }}`/`{{ .ConfirmationURL }}` usage.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
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
