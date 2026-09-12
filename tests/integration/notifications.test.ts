import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, listTasks } from "@/lib/tasks/tasks";
import { listReadKeys, markRead } from "@/lib/notifications/notifications";
import { deriveNotifications } from "@/lib/notifications/derive";
import type { DerivedNotification } from "@/lib/notifications/derive";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

// taskId is only used to build a unique key here; notifications.task_id has
// a real FK to flowdo.tasks, so these fixture ids (not real tasks) map to a
// null task_id rather than violating that constraint.
const overdueItem = (taskId: string): DerivedNotification => ({
  key: `overdue:${taskId}`, type: "overdue", title: "X", message: "Overdue", taskId: null, createdAt: new Date().toISOString(),
});

describe("notification dismissals", () => {
  it("markRead upserts a dismissal row and listReadKeys returns it; re-running is idempotent", async () => {
    const owner = await createConfirmedTestUser(admin, "notif-mark@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    await markRead(owner.client, owner.userId, [overdueItem("task-1")]);
    await markRead(owner.client, owner.userId, [overdueItem("task-1")]); // idempotent (onConflict)

    const { data: keys } = await listReadKeys(owner.client);
    expect(keys).toEqual(["overdue:task-1"]);
  });

  it("a user cannot read another user's dismissal keys", async () => {
    const owner = await createConfirmedTestUser(admin, "notif-rls-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "notif-rls-atk@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    await markRead(owner.client, owner.userId, [overdueItem("secret")]);
    const { data: keys } = await listReadKeys(attacker.client);
    expect(keys).toEqual([]);
  });

  it("hasDueDate filter returns only dated tasks and feeds derive end to end", async () => {
    const owner = await createConfirmedTestUser(admin, "notif-e2e@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    await createTask(owner.client, owner.userId, { title: "Overdue", dueDate: "2020-01-01T09:00:00.000Z" });
    await createTask(owner.client, owner.userId, { title: "No date" });

    const { data: tasks } = await listTasks(owner.client, { excludeCompleted: true, parentTaskId: null, hasDueDate: true });
    expect(tasks?.map((t) => t.title)).toEqual(["Overdue"]);

    const derived = deriveNotifications(tasks ?? [], new Set(), new Date());
    expect(derived.some((n) => n.type === "overdue")).toBe(true);
  });
});
