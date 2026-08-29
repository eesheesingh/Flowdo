import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { waitForEmail } from "../helpers/mailpit";
import { signUpUser } from "@/lib/auth/signup";
import { confirmEmailToken } from "@/lib/auth/confirm";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("signup confirmation email content", () => {
  it("renders the branded template with a working confirmation link", async () => {
    const client = createAnonClient();
    const email = `email-content-${Date.now()}@example.com`;

    const { error: signupError } = await signUpUser(client, {
      fullName: "Email Content Test",
      email,
      password: "StrongPass123!",
    });
    expect(signupError).toBeNull();

    const { data: usersPage } = await admin.auth.admin.listUsers();
    const created = usersPage.users.find((u) => u.email === email);
    createdUserIds.push(created!.id);

    const message = await waitForEmail(email);
    const body = message.Text ?? message.HTML ?? "";

    // The exact bug this test exists to catch: a stale OTP-code template
    // would show a 6-digit code and no clickable confirmation link at all.
    const linkMatch = body.match(/\/auth\/confirm\?token_hash=([^&\s"]+)&type=signup/);
    expect(linkMatch).not.toBeNull();
    const tokenHash = linkMatch![1];

    // The link found in the real email must actually work, end to end.
    const { error: confirmError } = await confirmEmailToken(client, { tokenHash, type: "signup" });
    expect(confirmError).toBeNull();

    const { data: refreshed } = await admin.auth.admin.getUserById(created!.id);
    expect(refreshed.user?.email_confirmed_at).toBeTruthy();
  });
});
