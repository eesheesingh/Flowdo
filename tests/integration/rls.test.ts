import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("RLS: tasks", () => {
  it("prevents a user from reading another user's tasks", async () => {
    const a = await createConfirmedTestUser(admin, "rls-a@example.com", "Password123!");
    const b = await createConfirmedTestUser(admin, "rls-b@example.com", "Password123!");
    createdUserIds.push(a.userId, b.userId);

    const { error: insertError } = await a.client
      .from("tasks")
      .insert({ user_id: a.userId, title: "A's private task" });
    expect(insertError).toBeNull();

    const { data, error } = await b.client.from("tasks").select("*").eq("user_id", a.userId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("prevents a user from updating another user's task by supplying its id directly", async () => {
    const a = await createConfirmedTestUser(admin, "rls-c@example.com", "Password123!");
    const b = await createConfirmedTestUser(admin, "rls-d@example.com", "Password123!");
    createdUserIds.push(a.userId, b.userId);

    const { data: inserted } = await a.client
      .from("tasks")
      .insert({ user_id: a.userId, title: "A's task" })
      .select()
      .single();

    const { data: updated, error } = await b.client
      .from("tasks")
      .update({ title: "hijacked" })
      .eq("id", inserted!.id)
      .select();
    expect(error).toBeNull();
    expect(updated).toEqual([]);

    const { data: stillOriginal } = await a.client
      .from("tasks")
      .select("title")
      .eq("id", inserted!.id)
      .single();
    expect(stillOriginal?.title).toBe("A's task");
  });
});

describe("RLS: labels", () => {
  it("prevents a user from deleting another user's label", async () => {
    const a = await createConfirmedTestUser(admin, "rls-e@example.com", "Password123!");
    const b = await createConfirmedTestUser(admin, "rls-f@example.com", "Password123!");
    createdUserIds.push(a.userId, b.userId);

    const { data: label } = await a.client
      .from("labels")
      .insert({ user_id: a.userId, name: "urgent" })
      .select()
      .single();

    await b.client.from("labels").delete().eq("id", label!.id);

    const { data: stillThere } = await a.client.from("labels").select("*").eq("id", label!.id);
    expect(stillThere?.length).toBe(1);
  });
});

describe("RLS: profiles", () => {
  it("prevents a user from reading another user's profile row", async () => {
    const a = await createConfirmedTestUser(admin, "rls-g@example.com", "Password123!");
    const b = await createConfirmedTestUser(admin, "rls-h@example.com", "Password123!");
    createdUserIds.push(a.userId, b.userId);

    const { data, error } = await b.client.from("profiles").select("*").eq("id", a.userId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
