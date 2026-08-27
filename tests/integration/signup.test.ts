import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { signUpUser } from "@/lib/auth/signup";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("signUpUser", () => {
  it("creates an unverified user and a matching profile row", async () => {
    const client = createAnonClient();
    const email = `signup-${Date.now()}@example.com`;

    const { error } = await signUpUser(client, {
      fullName: "Grace Hopper",
      email,
      password: "StrongPass123!",
    });
    expect(error).toBeNull();

    const { data: usersPage } = await admin.auth.admin.listUsers();
    const created = usersPage.users.find((u) => u.email === email);
    expect(created).toBeDefined();
    expect(created!.email_confirmed_at).toBeFalsy();
    createdUserIds.push(created!.id);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", created!.id)
      .single();
    expect(profileError).toBeNull();
    expect(profile?.full_name).toBe("Grace Hopper");
  });

  it("returns a human-readable error for a duplicate email", async () => {
    // Supabase's auth.signUp() does NOT error for a duplicate email that is
    // still unconfirmed (it silently resends the confirmation instead, to
    // avoid leaking whether an email is registered) — it only errors once
    // the existing account is confirmed. Confirm the first account directly
    // via the admin API so this test deterministically exercises the real
    // "already registered" branch in signUpUser, instead of accidentally
    // passing because of an unrelated rate-limit error on a second
    // unconfirmed signup attempt.
    const client = createAnonClient();
    const email = `signup-dup-${Date.now()}@example.com`;
    await signUpUser(client, { fullName: "First", email, password: "StrongPass123!" });

    const { data: usersPage } = await admin.auth.admin.listUsers();
    const userId = usersPage.users.find((u) => u.email === email)!.id;
    createdUserIds.push(userId);
    await admin.auth.admin.updateUserById(userId, { email_confirm: true });

    const { error } = await signUpUser(client, {
      fullName: "Second",
      email,
      password: "StrongPass123!",
    });
    expect(error).toBe("An account with this email already exists.");
  });
});
