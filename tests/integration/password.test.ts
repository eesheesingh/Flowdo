import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { setNewPassword } from "@/lib/auth/password";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("setNewPassword", () => {
  it("updates the password so the old one stops working", async () => {
    const email = `reset-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "OldPass123!",
      email_confirm: true,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    await client.auth.signInWithPassword({ email, password: "OldPass123!" });

    const { error } = await setNewPassword(client, "NewPass123!");
    expect(error).toBeNull();

    const freshClient = createAnonClient();
    const { error: oldPasswordError } = await freshClient.auth.signInWithPassword({
      email,
      password: "OldPass123!",
    });
    expect(oldPasswordError).toBeTruthy();

    const { error: newPasswordError } = await freshClient.auth.signInWithPassword({
      email,
      password: "NewPass123!",
    });
    expect(newPasswordError).toBeNull();
  });
});
