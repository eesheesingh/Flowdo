import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask } from "@/lib/tasks/tasks";
import { createLabel, listLabels, updateLabel, deleteLabel } from "@/lib/labels/labels";
import { setTaskLabels, listTaskLabels } from "@/lib/tasks/task-labels";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("labels", () => {
  it("CRUDs a label owned by the caller", async () => {
    const owner = await createConfirmedTestUser(admin, "labels-crud@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: label, error } = await createLabel(owner.client, owner.userId, { name: "Work", color: "#4F46E5" });
    expect(error).toBeNull();
    expect(label?.name).toBe("Work");

    await updateLabel(owner.client, label!.id, { name: "Job" });
    const { data: labels } = await listLabels(owner.client);
    expect(labels?.map((l) => l.name)).toEqual(["Job"]);

    await deleteLabel(owner.client, label!.id);
    const { data: afterDelete } = await listLabels(owner.client);
    expect(afterDelete).toEqual([]);
  });

  it("rejects a duplicate label name for the same user", async () => {
    const owner = await createConfirmedTestUser(admin, "labels-dup@example.com", "Password123!");
    createdUserIds.push(owner.userId);
    await createLabel(owner.client, owner.userId, { name: "Home", color: "#16A34A" });
    const { error } = await createLabel(owner.client, owner.userId, { name: "Home", color: "#16A34A" });
    expect(error).toMatch(/already have a label/i);
  });

  it("setTaskLabels adds and removes the diff", async () => {
    const owner = await createConfirmedTestUser(admin, "labels-assign@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Tagged" });
    const { data: a } = await createLabel(owner.client, owner.userId, { name: "A", color: "#4F46E5" });
    const { data: b } = await createLabel(owner.client, owner.userId, { name: "B", color: "#DC2626" });

    await setTaskLabels(owner.client, task!.id, [a!.id, b!.id]);
    expect((await listTaskLabels(owner.client, task!.id)).data?.sort()).toEqual([a!.id, b!.id].sort());

    await setTaskLabels(owner.client, task!.id, [b!.id]);
    expect((await listTaskLabels(owner.client, task!.id)).data).toEqual([b!.id]);
  });

  it("a different user cannot read or tag with the owner's label", async () => {
    const owner = await createConfirmedTestUser(admin, "labels-rls-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "labels-rls-attacker@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    const { data: label } = await createLabel(owner.client, owner.userId, { name: "Secret", color: "#4F46E5" });
    const { data: attackerLabels } = await listLabels(attacker.client);
    expect(attackerLabels?.find((l) => l.id === label!.id)).toBeUndefined();

    const { data: attackerTask } = await createTask(attacker.client, attacker.userId, { title: "atk" });
    const { error } = await setTaskLabels(attacker.client, attackerTask!.id, [label!.id]);
    expect(error).toMatch(/couldn't update task labels/i); // task_labels_insert_own blocks it
  });
});
