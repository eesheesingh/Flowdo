const GUEST_ONLY_PATHS = ["/login", "/signup", "/verify"];

export function resolveRedirect(input: {
  pathname: string;
  isAuthenticated: boolean;
  isVerified: boolean;
}): string | null {
  const { pathname, isAuthenticated, isVerified } = input;
  const isAppRoute = pathname.startsWith("/app");
  const isGuestOnlyRoute = GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p));

  if (isAppRoute) {
    if (!isAuthenticated) return "/login";
    if (!isVerified && pathname !== "/verify") return "/verify";
    return null;
  }

  if (isGuestOnlyRoute) {
    if (isAuthenticated && isVerified) return "/app/dashboard";
  }

  return null;
}
