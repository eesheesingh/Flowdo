import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { waitForEmail } from "../helpers/mailpit";
import { requestPasswordReset, setNewPassword } from "@/lib/auth/password";
import { confirmEmailToken } from "@/lib/auth/confirm";

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

describe("requestPasswordReset", () => {
  // requestPasswordReset reads `window.location.origin` — correct in its real
  // call site (a Client Component's onSubmit handler, always browser-side),
  // but this suite runs under vitest.integration.config.ts's `environment:
  // "node"`, where `window` is undefined. Stub the one property it reads,
  // matching what a real browser would provide, rather than changing the
  // (correct) implementation to work around a test-environment gap.
  beforeEach(() => {
    vi.stubGlobal("window", { location: { origin: "http://127.0.0.1:3000" } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resets a password via the real emailed recovery link end-to-end (regression test for the missing token-exchange bug)", async () => {
    const email = `reset-e2e-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({ email, password: "OldPass123!", email_confirm: true });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    const { error: requestError } = await requestPasswordReset(client, email);
    expect(requestError).toBeNull();

    const message = await waitForEmail(email);
    const body = message.Text ?? message.HTML ?? "";
    const linkMatch = body.match(/token_hash=([^&\s"]+)/);
    expect(linkMatch).not.toBeNull();
    const tokenHash = linkMatch![1];

    const { error: confirmError } = await confirmEmailToken(client, { tokenHash, type: "recovery" });
    expect(confirmError).toBeNull();

    const { error: setPasswordError } = await setNewPassword(client, "NewPass123!");
    expect(setPasswordError).toBeNull();

    const freshClient = createAnonClient();
    const { error: newPasswordError } = await freshClient.auth.signInWithPassword({
      email,
      password: "NewPass123!",
    });
    expect(newPasswordError).toBeNull();
  });
});
