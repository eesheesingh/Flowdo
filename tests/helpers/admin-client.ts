import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.test" });

export const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const LOCAL_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const LOCAL_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
