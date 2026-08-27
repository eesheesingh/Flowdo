import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient, createAnonClient } from "../helpers/admin-client";
import { logInUser } from "@/lib/auth/login";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("logInUser", () => {
  it("rejects an incorrect password", async () => {
    const email = `login-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "CorrectPass123!",
      email_confirm: true,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    const { error } = await logInUser(client, { email, password: "WrongPass123!" });
    expect(error).toBeTruthy();
  });

  it("flags an unverified account as needing verification", async () => {
    const email = `login-unverified-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "CorrectPass123!",
      email_confirm: false,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    const { error, needsVerification } = await logInUser(client, {
      email,
      password: "CorrectPass123!",
    });
    expect(error).toBeNull();
    expect(needsVerification).toBe(true);
  });

  it("logs in a verified user successfully", async () => {
    const email = `login-ok-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "CorrectPass123!",
      email_confirm: true,
    });
    createdUserIds.push(data.user!.id);

    const client = createAnonClient();
    const { error, needsVerification } = await logInUser(client, {
      email,
      password: "CorrectPass123!",
    });
    expect(error).toBeNull();
    expect(needsVerification).toBe(false);
  });
});
