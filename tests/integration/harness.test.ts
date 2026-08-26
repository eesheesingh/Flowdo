import { describe, it, expect } from "vitest";
import { createAdminClient } from "../helpers/admin-client";

describe("integration test harness", () => {
  it("can reach the local Supabase auth admin API", async () => {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers();
    expect(error).toBeNull();
    expect(Array.isArray(data.users)).toBe(true);
  });
});
