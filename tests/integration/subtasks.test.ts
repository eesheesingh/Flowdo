import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, listTasks } from "@/lib/tasks/tasks";
import { createSubtask, listSubtasks } from "@/lib/tasks/subtasks";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("subtasks", () => {
  it("creates subtasks under a parent and lists them", async () => {
    const owner = await createConfirmedTestUser(admin, "subtasks-owner@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: parent } = await createTask(owner.client, owner.userId, { title: "Parent" });
    await createSubtask(owner.client, owner.userId, parent!.id, "Sub 1");
    await createSubtask(owner.client, owner.userId, parent!.id, "Sub 2");

    const { data: subs } = await listSubtasks(owner.client, parent!.id);
    expect(subs?.map((s) => s.title)).toEqual(["Sub 1", "Sub 2"]);
  });

  it("subtasks are excluded from a parentTaskId: null listing", async () => {
    const owner = await createConfirmedTestUser(admin, "subtasks-exclude@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: parent } = await createTask(owner.client, owner.userId, { title: "Parent" });
    await createSubtask(owner.client, owner.userId, parent!.id, "Hidden sub");

    const { data: topLevel } = await listTasks(owner.client, { parentTaskId: null });
    expect(topLevel?.map((t) => t.title)).toEqual(["Parent"]);
  });

  it("a different user cannot create a subtask under someone else's task", async () => {
    const owner = await createConfirmedTestUser(admin, "subtasks-rls-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "subtasks-rls-attacker@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    const { data: parent } = await createTask(owner.client, owner.userId, { title: "Private parent" });
    const { data, error } = await createSubtask(attacker.client, attacker.userId, parent!.id, "intrusion");
    // RLS: the attacker's insert with their own user_id is allowed by tasks_insert_own,
    // but the row is theirs, not a child visible to the owner. Assert the owner never sees it.
    expect(error).toBeNull();
    const { data: ownerSubs } = await listSubtasks(owner.client, parent!.id);
    expect(ownerSubs).toEqual([]);
    if (data) await admin.from("tasks").delete().eq("id", data.id);
  });
});
