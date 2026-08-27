import { describe, it, expect } from "vitest";
import { resolveRedirect } from "./redirect";

describe("resolveRedirect", () => {
  it("sends an unauthenticated user hitting /app to /login", () => {
    expect(
      resolveRedirect({ pathname: "/app/dashboard", isAuthenticated: false, isVerified: false })
    ).toBe("/login");
  });

  it("sends an authenticated but unverified user hitting /app to /verify", () => {
    expect(
      resolveRedirect({ pathname: "/app/dashboard", isAuthenticated: true, isVerified: false })
    ).toBe("/verify");
  });

  it("allows an authenticated and verified user into /app", () => {
    expect(
      resolveRedirect({ pathname: "/app/dashboard", isAuthenticated: true, isVerified: true })
    ).toBeNull();
  });

  it("sends an authenticated and verified user away from /login to the dashboard", () => {
    expect(
      resolveRedirect({ pathname: "/login", isAuthenticated: true, isVerified: true })
    ).toBe("/app/dashboard");
  });

  it("does not redirect an unauthenticated user visiting /login", () => {
    expect(
      resolveRedirect({ pathname: "/login", isAuthenticated: false, isVerified: false })
    ).toBeNull();
  });

  it("does not redirect an authenticated unverified user visiting /verify", () => {
    expect(
      resolveRedirect({ pathname: "/verify", isAuthenticated: true, isVerified: false })
    ).toBeNull();
  });

  it("sends an authenticated and verified user away from /verify to the dashboard", () => {
    expect(
      resolveRedirect({ pathname: "/verify", isAuthenticated: true, isVerified: true })
    ).toBe("/app/dashboard");
  });

  it("does not redirect a verified, authenticated user visiting /reset-password", () => {
    expect(
      resolveRedirect({ pathname: "/reset-password", isAuthenticated: true, isVerified: true })
    ).toBeNull();
  });

  it("does not redirect a verified, authenticated user visiting /forgot-password", () => {
    expect(
      resolveRedirect({ pathname: "/forgot-password", isAuthenticated: true, isVerified: true })
    ).toBeNull();
  });
});
