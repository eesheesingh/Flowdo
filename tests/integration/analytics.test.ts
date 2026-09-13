import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, completeTask } from "@/lib/tasks/tasks";
import { createProject } from "@/lib/projects/projects";
import { getAnalyticsSnapshot } from "@/lib/analytics/analytics";
import { queryLocalDb } from "../helpers/pg-client";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("getAnalyticsSnapshot", () => {
  it("returns exactly the minimal shape for the caller's own top-level tasks", async () => {
    const owner = await createConfirmedTestUser(admin, "analytics-snapshot@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: project } = await createProject(owner.client, owner.userId, {
      name: "Launch",
      color: "#4F46E5",
      icon: "folder",
    });
    const { data: t1 } = await createTask(owner.client, owner.userId, {
      title: "A",
      priority: "URGENT",
      projectId: project!.id,
      dueDate: "2026-01-01T00:00:00.000Z",
    });
    await completeTask(owner.client, t1!.id);
    const { data: t2 } = await createTask(owner.client, owner.userId, { title: "B", priority: "LOW" });
    await createTask(owner.client, owner.userId, { title: "Sub", parentTaskId: t2!.id });

    const { data, error } = await getAnalyticsSnapshot(owner.client, owner.userId);
    expect(error).toBeNull();
    // The subtask (parent_task_id set) is excluded; t1 + t2 are the only top-level rows.
    expect(data).toHaveLength(2);

    const byId = new Map(data!.map((r) => [r.id, r]));
    // due_date is a timestamptz column; PostgREST serializes it with a
    // "+00:00" offset rather than "Z", so compare the represented instant
    // instead of the raw string.
    expect(byId.get(t1!.id)).toMatchObject({
      status: "COMPLETED",
      priority: "URGENT",
      project_id: project!.id,
    });
    expect(new Date(byId.get(t1!.id)!.due_date!).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(byId.get(t1!.id)!.completed_at).not.toBeNull();
    expect(byId.get(t2!.id)).toMatchObject({
      status: "TODO",
      priority: "LOW",
      project_id: null,
      due_date: null,
      completed_at: null,
    });
  });

  it("does not return another user's tasks (RLS)", async () => {
    const owner = await createConfirmedTestUser(admin, "analytics-rls-owner@example.com", "Password123!");
    const stranger = await createConfirmedTestUser(admin, "analytics-rls-stranger@example.com", "Password123!");
    createdUserIds.push(owner.userId, stranger.userId);
    await createTask(owner.client, owner.userId, { title: "Private" });

    const { data } = await getAnalyticsSnapshot(stranger.client, stranger.userId);
    expect(data).toEqual([]);
  });

  // Finding 5 (Important, phase 4 final review): after migrations 0012+0014,
  // tasks_select_own also returns a shared project's other-member-owned
  // tasks -- correct for task-list views, but /app/analytics is framed as
  // "my own productivity." This guards the explicit .eq("user_id", ...)
  // scoping filter added to getAnalyticsSnapshot: a project mate's tasks
  // must NOT leak into the caller's personal analytics, even though RLS
  // now lets the caller SELECT them.
  it("does not mix a shared project mate's tasks into the caller's personal analytics", async () => {
    const owner = await createConfirmedTestUser(admin, "analytics-mate-owner@example.com", "Password123!");
    const mate = await createConfirmedTestUser(admin, "analytics-mate-member@example.com", "Password123!");
    createdUserIds.push(owner.userId, mate.userId);

    const { data: project } = await createProject(owner.client, owner.userId, {
      name: "Shared",
      color: "#4F46E5",
      icon: "folder",
    });
    await queryLocalDb(`insert into flowdo.project_members (project_id, user_id, role) values ($1, $2, 'MEMBER')`, [
      project!.id,
      mate.userId,
    ]);
    await createTask(owner.client, owner.userId, { title: "Owner's task", projectId: project!.id });

    const { data } = await getAnalyticsSnapshot(mate.client, mate.userId);
    expect(data).toEqual([]);
  });
});
