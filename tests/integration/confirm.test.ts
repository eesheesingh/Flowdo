import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { confirmEmailToken } from "@/lib/auth/confirm";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("confirmEmailToken", () => {
  it("rejects an incorrect token hash", async () => {
    const email = `confirm-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({ email, password: "StrongPass123!", email_confirm: false });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    const { error } = await confirmEmailToken(client, { tokenHash: "not-a-real-hash", type: "signup" });
    expect(error).toBeTruthy();
  });

  it("confirms a signup link and marks the account verified", async () => {
    const email = `confirm-signup-${Date.now()}@example.com`;
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: "StrongPass123!",
    });
    createdUserIds.push(linkData.user!.id);

    const client = createAnonClient();
    const { error } = await confirmEmailToken(client, {
      tokenHash: linkData.properties!.hashed_token,
      type: "signup",
    });
    expect(error).toBeNull();

    const { data: refreshed } = await admin.auth.admin.getUserById(linkData.user!.id);
    expect(refreshed.user?.email_confirmed_at).toBeTruthy();
  });

  it("confirms a recovery link and establishes a session (the actual password-reset bug fix)", async () => {
    const email = `confirm-recovery-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({ email, password: "OldPass123!", email_confirm: true });
    createdUserIds.push(data.user!.id);

    const { data: linkData } = await admin.auth.admin.generateLink({ type: "recovery", email });

    const client = createAnonClient();
    const { error } = await confirmEmailToken(client, {
      tokenHash: linkData.properties!.hashed_token,
      type: "recovery",
    });
    expect(error).toBeNull();

    const { data: sessionData } = await client.auth.getSession();
    expect(sessionData.session).toBeTruthy();
  });
});
