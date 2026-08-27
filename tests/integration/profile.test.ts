import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { updateProfile } from "@/lib/auth/profile";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("updateProfile", () => {
  it("updates the caller's own profile full_name", async () => {
    const email = `profile-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "StrongPass123!",
      email_confirm: true,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    await client.auth.signInWithPassword({ email, password: "StrongPass123!" });

    const { error } = await updateProfile(client, data.user!.id, { fullName: "Updated Name" });
    expect(error).toBeNull();

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", data.user!.id).single();
    expect(profile?.full_name).toBe("Updated Name");
  });

  it("does not allow a user to change their own profile email via a direct update", async () => {
    const email = `profile-email-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "StrongPass123!",
      email_confirm: true,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    await client.auth.signInWithPassword({ email, password: "StrongPass123!" });

    const { data: updated, error } = await client
      .from("profiles")
      .update({ email: "attacker@evil.com" })
      .eq("id", data.user!.id)
      .select();

    // Column-level privileges revoke UPDATE on `email` for authenticated users,
    // so this should either error outright, or (PostgREST's default when a
    // partial column grant blocks part of a multi-column statement) silently
    // affect zero rows. Either way, the row's email must be unchanged.
    if (!error) {
      expect(updated).toEqual([]);
    }

    const { data: profile } = await admin.from("profiles").select("email").eq("id", data.user!.id).single();
    expect(profile?.email).toBe(email);
  });
});
