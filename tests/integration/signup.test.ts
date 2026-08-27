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
    const client = createAnonClient();
    const email = `signup-dup-${Date.now()}@example.com`;
    await signUpUser(client, { fullName: "First", email, password: "StrongPass123!" });

    const { data: usersPage } = await admin.auth.admin.listUsers();
    createdUserIds.push(usersPage.users.find((u) => u.email === email)!.id);

    const { error } = await signUpUser(client, {
      fullName: "Second",
      email,
      password: "StrongPass123!",
    });
    expect(error).toBeTruthy();
  });
});
