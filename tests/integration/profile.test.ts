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
});
