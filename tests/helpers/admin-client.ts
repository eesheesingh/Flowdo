import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// override: true is required here — dotenv does NOT override already-set
// environment variables by default. Without it, a developer's shell (or a
// CI config) that already exports these vars pointing at a real hosted
// project would silently win over .env.test, and the guard below would be
// checking the wrong value.
config({ path: ".env.test", override: true });
// .env.test.local (gitignored, never committed) optionally layers on top of
// .env.test — used to point the integration suite at the team's hosted dev
// project instead of local Docker Supabase. .env.test itself stays checked
// in with the local CLI stack's well-known, non-secret demo keys; a real
// project's service_role key must never land in a tracked file.
config({ path: ".env.test.local", override: true });

export const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const LOCAL_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const LOCAL_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Hard guard: these integration tests perform destructive admin operations
// (e.g. admin.auth.admin.deleteUser). Refuse to run against anything that
// isn't obviously the local Supabase CLI stack OR the one explicitly
// allow-listed hosted dev project below (opt-in via .env.test.local, never
// by silently accepting an arbitrary URL).
const ALLOWED_HOSTED_TEST_HOST = "nsurmnrhpkvqsggrvjiz.supabase.co";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(LOCAL_SUPABASE_URL);
const isAllowedHosted = LOCAL_SUPABASE_URL === `https://${ALLOWED_HOSTED_TEST_HOST}`;
if (!isLocal && !isAllowedHosted) {
  throw new Error(
    `Integration tests must run against a local Supabase instance or the allow-listed hosted dev ` +
      `project, got: ${LOCAL_SUPABASE_URL}. This guard exists specifically to prevent destructive ` +
      `admin operations against an unintended real project.`
  );
}

// No explicit return type annotation: createClient(...)'s actual return type
// is parameterized with the "flowdo" schema (via the db.schema option), which
// isn't assignable to the plain SupabaseClient default (parameterized with
// "public"). Let TypeScript infer the correct schema-parameterized type
// instead of fighting it with a wrong annotation.
export function createAdminClient() {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
    db: { schema: "flowdo" },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createAnonClient() {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
    db: { schema: "flowdo" },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
