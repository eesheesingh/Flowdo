import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { waitForEmail } from "../helpers/mailpit";
import { signUpUser } from "@/lib/auth/signup";
import { verifyOtpCode } from "@/lib/auth/verify";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("signup confirmation email content", () => {
  it("renders the branded template with a visible 6-digit code and no magic link", async () => {
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

    expect(message.Subject).toContain("Verify your email");

    // The exact bug this test exists to catch: Supabase's DEFAULT template is
    // magic-link-only and never shows a code. Every other integration test
    // fetches the OTP via the admin API, bypassing the real email entirely —
    // this is the one test that actually reads what a user would see.
    expect(body).not.toMatch(/confirm email address/i);
    expect(body).not.toMatch(/https?:\/\/\S+\/auth\/v1\/verify/i);

    const otpMatch = body.match(/\b(\d{6})\b/);
    expect(otpMatch).not.toBeNull();
    const code = otpMatch![1];

    // The code shown in the email must actually work, end to end.
    const { error: verifyError } = await verifyOtpCode(client, email, code);
    expect(verifyError).toBeNull();

    const { data: refreshed } = await admin.auth.admin.getUserById(created!.id);
    expect(refreshed.user?.email_confirmed_at).toBeTruthy();
  });
});
