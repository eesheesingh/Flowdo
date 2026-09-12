import { createAnonClient, type createAdminClient } from "./admin-client";

const SIGN_IN_MAX_ATTEMPTS = 5;
const SIGN_IN_RETRY_DELAYS_MS = [300, 600, 1200, 2000];

// Supabase Auth's rate limiter is a token bucket: the dashboard's configured
// rate (e.g. 1000 requests/5 min) only controls the refill rate, but every
// per-IP bucket has a hard ~30-request BURST capacity regardless of that
// setting (confirmed against this project's actual Auth service, not just
// docs). Running dozens of integration tests back-to-back easily bursts
// past that before the bucket refills, producing `over_request_rate_limit`
// even though the 5-minute quota is nowhere near exhausted. A short
// backoff-and-retry lets the bucket refill between attempts instead of
// failing the test outright — root-caused here since every integration
// test's sign-in routes through this one function.
async function signInWithRetry(client: ReturnType<typeof createAnonClient>, email: string, password: string) {
  let lastError: { message: string; status?: number } | null = null;
  for (let attempt = 0; attempt < SIGN_IN_MAX_ATTEMPTS; attempt++) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };
    lastError = error;
    if (error.status !== 429 || attempt === SIGN_IN_MAX_ATTEMPTS - 1) break;
    await new Promise((resolve) => setTimeout(resolve, SIGN_IN_RETRY_DELAYS_MS[attempt]));
  }
  return { error: lastError };
}

export async function createConfirmedTestUser(
  admin: ReturnType<typeof createAdminClient>,
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
  const { error: signInError } = await signInWithRetry(client, email, password);
  if (signInError) {
    throw new Error(`failed to sign in test user: ${signInError.message}`);
  }

  return { userId: data.user.id, client };
}
