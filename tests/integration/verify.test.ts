import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { verifyOtpCode } from "@/lib/auth/verify";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("verifyOtpCode", () => {
  it("rejects an incorrect code", async () => {
    const email = `verify-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "StrongPass123!",
      email_confirm: false,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    const { error } = await verifyOtpCode(client, email, "000000");
    expect(error).toBeTruthy();
  });

  it("accepts the correct code and confirms the account", async () => {
    const email = `verify-ok-${Date.now()}@example.com`;
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: "StrongPass123!",
    });
    createdUserIds.push(linkData.user!.id);
    const otp = linkData.properties!.email_otp;

    const client = createAnonClient();
    const { error } = await verifyOtpCode(client, email, otp);
    expect(error).toBeNull();

    const { data: refreshed } = await admin.auth.admin.getUserById(linkData.user!.id);
    expect(refreshed.user?.email_confirmed_at).toBeTruthy();
  });
});
