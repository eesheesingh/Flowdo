import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, completeTask, listTasks } from "@/lib/tasks/tasks";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("recurring tasks", () => {
  it("completing a WEEKLY task creates the next occurrence 7 days later", async () => {
    const owner = await createConfirmedTestUser(admin, "recur-weekly@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const due = "2026-03-15T09:00:00.000Z";
    const { data: task } = await createTask(owner.client, owner.userId, {
      title: "Water plants",
      dueDate: due,
      recurrence: "WEEKLY",
    });
    await completeTask(owner.client, task!.id);

    const { data: open } = await listTasks(owner.client, { excludeCompleted: true });
    const next = open?.find((t) => t.title === "Water plants");
    expect(next).toBeTruthy();
    // Postgres timestamptz round-trips as "+00:00"; compare the instant, not the string form.
    expect(new Date(next!.due_date!).toISOString()).toBe("2026-03-22T09:00:00.000Z");
    expect(next!.recurrence).toBe("WEEKLY");
    expect(next!.id).not.toBe(task!.id);
  });

  it("a recurring task with no due date creates no occurrence", async () => {
    const owner = await createConfirmedTestUser(admin, "recur-nodue@example.com", "Password123!");
    createdUserIds.push(owner.userId);
    const { data: task } = await createTask(owner.client, owner.userId, { title: "Someday", recurrence: "DAILY" });
    await completeTask(owner.client, task!.id);
    const { data: open } = await listTasks(owner.client, { excludeCompleted: true });
    expect(open?.find((t) => t.title === "Someday")).toBeUndefined();
  });

  it("a NEVER task creates no occurrence", async () => {
    const owner = await createConfirmedTestUser(admin, "recur-never@example.com", "Password123!");
    createdUserIds.push(owner.userId);
    const { data: task } = await createTask(owner.client, owner.userId, {
      title: "One off",
      dueDate: "2026-03-15T09:00:00.000Z",
    });
    await completeTask(owner.client, task!.id);
    const { data: open } = await listTasks(owner.client, { excludeCompleted: true });
    expect(open?.find((t) => t.title === "One off")).toBeUndefined();
  });
});
