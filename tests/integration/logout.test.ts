import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { logOutUser } from "@/lib/auth/logout";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("logOutUser", () => {
  it("clears the active session", async () => {
    const email = `logout-${Date.now()}@example.com`;
    const { userId, client } = await createConfirmedTestUser(admin, email, "StrongPass123!");
    createdUserIds.push(userId);

    const beforeSession = (await client.auth.getSession()).data.session;
    expect(beforeSession).not.toBeNull();

    await logOutUser(client);

    const afterSession = (await client.auth.getSession()).data.session;
    expect(afterSession).toBeNull();
  });
});
