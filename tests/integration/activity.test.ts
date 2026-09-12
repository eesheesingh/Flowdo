import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, updateTask, completeTask, reopenTask, deleteTask } from "@/lib/tasks/tasks";
import { createProject, archiveProject } from "@/lib/projects/projects";
import { listActivity } from "@/lib/activity/activity";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("activity log triggers", () => {
  it("records create/update/complete/reopen for a task", async () => {
    const owner = await createConfirmedTestUser(admin, "activity-task@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Track me" });
    await updateTask(owner.client, task!.id, { priority: "HIGH" });
    await completeTask(owner.client, task!.id);
    await reopenTask(owner.client, task!.id);

    const { data: activity } = await listActivity(owner.client, { taskId: task!.id });
    const actions = activity!.map((a) => a.action).reverse(); // oldest first
    expect(actions).toEqual(["task.created", "task.updated", "task.completed", "task.reopened"]);
  });

  it("records a delete with task_id null and the title in metadata (no FK violation)", async () => {
    const owner = await createConfirmedTestUser(admin, "activity-delete@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Doomed" });
    const { error } = await deleteTask(owner.client, task!.id);
    expect(error).toBeNull();

    const { data: activity } = await listActivity(owner.client, { limit: 50 });
    const del = activity!.find((a) => a.action === "task.deleted");
    expect(del).toBeTruthy();
    expect(del!.task_id).toBeNull();
    expect((del!.metadata as Record<string, unknown>).title).toBe("Doomed");
  });

  it("records project create + archive", async () => {
    const owner = await createConfirmedTestUser(admin, "activity-project@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: project } = await createProject(owner.client, owner.userId, {
      name: "Site",
      color: "#4F46E5",
      icon: "folder",
    });
    await archiveProject(owner.client, project!.id);

    const { data: activity } = await listActivity(owner.client, { projectId: project!.id });
    const actions = activity!.map((a) => a.action).reverse();
    expect(actions).toEqual(["project.created", "project.archived"]);
  });

  it("a user cannot read another user's activity", async () => {
    const owner = await createConfirmedTestUser(admin, "activity-rls-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "activity-rls-atk@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Private" });
    const { data: attackerView } = await listActivity(attacker.client, { taskId: task!.id });
    expect(attackerView).toEqual([]);
  });
});
