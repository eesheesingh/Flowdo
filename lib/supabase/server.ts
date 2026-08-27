import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "flowdo" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
            // @supabase/ssr (0.12+) passes a second `headers` argument on the
            // token-refresh path (e.g. Cache-Control: no-store) meant to be
            // applied to the HTTP response. Server Components can't set
            // response headers directly — only Route Handlers/Middleware can
            // — so there's nothing to do with it here; middleware.ts is the
            // actual path that refreshes and persists the session, and it
            // does apply these headers.
          } catch {
            // called from a Server Component render; middleware refreshes the session instead
          }
        },
      },
    }
  );
}
