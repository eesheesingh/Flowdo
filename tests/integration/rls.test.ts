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

describe("RLS: project_members recursion guard", () => {
  it("lets an owner and a member list projects and project_members without recursion errors", async () => {
    const owner = await createConfirmedTestUser(admin, "rls-proj-owner@example.com", "Password123!");
    const member = await createConfirmedTestUser(admin, "rls-proj-member@example.com", "Password123!");
    createdUserIds.push(owner.userId, member.userId);

    const { data: project, error: projectError } = await owner.client
      .from("projects")
      .insert({ name: "Recursion test project", owner_id: owner.userId })
      .select()
      .single();
    expect(projectError).toBeNull();

    const { error: memberInsertError } = await owner.client
      .from("project_members")
      .insert({ project_id: project!.id, user_id: member.userId, role: "MEMBER" });
    expect(memberInsertError).toBeNull();

    const { data: memberProjects, error: memberSelectError } = await member.client
      .from("projects")
      .select("*")
      .eq("id", project!.id);
    expect(memberSelectError).toBeNull();
    expect(memberProjects?.length).toBe(1);

    const { data: memberRows, error: memberRowsError } = await member.client
      .from("project_members")
      .select("*")
      .eq("project_id", project!.id);
    expect(memberRowsError).toBeNull();
    expect(memberRows?.length).toBe(2);
  });
});

describe("RLS: projects owner_id transfer guard", () => {
  it("prevents a non-owner admin from reassigning owner_id, but allows other field updates", async () => {
    const owner = await createConfirmedTestUser(admin, "rls-owner-guard@example.com", "Password123!");
    const adminMember = await createConfirmedTestUser(admin, "rls-admin-guard@example.com", "Password123!");
    createdUserIds.push(owner.userId, adminMember.userId);

    const { data: project } = await owner.client
      .from("projects")
      .insert({ name: "Ownership guard project", owner_id: owner.userId })
      .select()
      .single();

    await owner.client
      .from("project_members")
      .insert({ project_id: project!.id, user_id: adminMember.userId, role: "ADMIN" });

    const { error: hijackError } = await adminMember.client
      .from("projects")
      .update({ owner_id: adminMember.userId })
      .eq("id", project!.id);
    expect(hijackError).toBeTruthy();

    const { data: stillOwnedByOriginal } = await owner.client
      .from("projects")
      .select("owner_id")
      .eq("id", project!.id)
      .single();
    expect(stillOwnedByOriginal?.owner_id).toBe(owner.userId);

    const { error: renameError } = await adminMember.client
      .from("projects")
      .update({ name: "Renamed by admin" })
      .eq("id", project!.id);
    expect(renameError).toBeNull();
  });
});
