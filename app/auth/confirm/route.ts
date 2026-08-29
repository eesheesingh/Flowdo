import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmEmailToken } from "@/lib/auth/confirm";

const ALLOWED_TYPES = ["signup", "recovery"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

// Deliberately NOT `new URL(request.url).origin`: on a self-hosted Next.js
// server (`next dev` / `next start`, no reverse proxy rewriting the request
// target), request.url's host is built from the server's own bind address
// rather than the client's actual Host header — verified locally by logging
// both: with Host: 127.0.0.1:3000 (matching Supabase's local site_url, so
// this is exactly what the real confirmation/recovery links point at),
// request.url still reported origin http://localhost:3000. Because the
// session cookie verifyOtp sets is scoped (host-only) to the host the
// browser actually used, redirecting to a *different* host than the one the
// browser is on drops the cookie — the browser lands "logged out" and
// middleware bounces it to /login, silently defeating the whole fix this
// route exists to provide. Deriving the origin from the incoming
// Host/X-Forwarded-Host header instead keeps the redirect on the same host
// the session cookie was just set for.
function resolveOrigin(request: NextRequest): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${url.protocol}//${host}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = resolveOrigin(request);
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const next = searchParams.get("next") ?? "/app/dashboard";

  if (tokenHash && typeParam && (ALLOWED_TYPES as readonly string[]).includes(typeParam)) {
    const supabase = await createClient();
    const { error } = await confirmEmailToken(supabase, { tokenHash, type: typeParam as AllowedType });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invalid-or-expired-link`);
}
