import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import {
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  reopenTask,
  listTasks,
  updateTaskPosition,
} from "@/lib/tasks/tasks";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("createTask", () => {
  it("creates a task owned by the caller with sensible defaults", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-create@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data, error } = await createTask(owner.client, owner.userId, { title: "Buy milk" });
    expect(error).toBeNull();
    expect(data?.status).toBe("TODO");
    expect(data?.priority).toBe("MEDIUM");
    expect(data?.user_id).toBe(owner.userId);
  });

  it("a different user cannot see or modify the task (RLS through the application layer)", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "tasks-attacker@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Private task" });

    const { data: attackerView } = await listTasks(attacker.client, {});
    expect(attackerView?.find((t) => t.id === task!.id)).toBeUndefined();

    const { data: updated } = await updateTask(attacker.client, task!.id, { title: "hijacked" });
    expect(updated).toBeNull();
  });
});

describe("updateTask / deleteTask", () => {
  it("updates fields and can be deleted by the owner", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-update@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Draft" });
    const { data: updated, error } = await updateTask(owner.client, task!.id, { title: "Final", priority: "HIGH" });
    expect(error).toBeNull();
    expect(updated?.title).toBe("Final");
    expect(updated?.priority).toBe("HIGH");

    const { error: deleteError } = await deleteTask(owner.client, task!.id);
    expect(deleteError).toBeNull();

    const { data: afterDelete } = await listTasks(owner.client, {});
    expect(afterDelete?.find((t) => t.id === task!.id)).toBeUndefined();
  });
});

describe("completeTask / reopenTask", () => {
  it("sets and clears completed_at and status", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-complete@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Finish report" });
    const { error: completeError } = await completeTask(owner.client, task!.id);
    expect(completeError).toBeNull();

    const { data: afterComplete } = await listTasks(owner.client, { status: "COMPLETED" });
    const completed = afterComplete?.find((t) => t.id === task!.id);
    expect(completed?.status).toBe("COMPLETED");
    expect(completed?.completed_at).not.toBeNull();

    const { error: reopenError } = await reopenTask(owner.client, task!.id);
    expect(reopenError).toBeNull();

    const { data: afterReopen } = await listTasks(owner.client, { status: "TODO" });
    const reopened = afterReopen?.find((t) => t.id === task!.id);
    expect(reopened?.status).toBe("TODO");
    expect(reopened?.completed_at).toBeNull();
  });
});

describe("listTasks filters", () => {
  it("filters by projectId null (Inbox) vs a specific project", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-inbox@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: project } = await owner.client
      .from("projects")
      .insert({ owner_id: owner.userId, name: "Website", color: "#4F46E5" })
      .select()
      .single();

    await createTask(owner.client, owner.userId, { title: "No project" });
    await createTask(owner.client, owner.userId, { title: "In project", projectId: project!.id });

    const { data: inboxTasks } = await listTasks(owner.client, { projectId: null });
    expect(inboxTasks?.map((t) => t.title)).toEqual(["No project"]);

    const { data: projectTasks } = await listTasks(owner.client, { projectId: project!.id });
    expect(projectTasks?.map((t) => t.title)).toEqual(["In project"]);
  });

  it("filters by dueDate today/upcoming and excludes completed", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-duedate@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const today = new Date().toISOString();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: todayTask } = await createTask(owner.client, owner.userId, { title: "Due today", dueDate: today });
    await createTask(owner.client, owner.userId, { title: "Due next week", dueDate: nextWeek });
    await completeTask(owner.client, todayTask!.id);
    const { data: anotherToday } = await createTask(owner.client, owner.userId, { title: "Also today", dueDate: today });

    const { data: todayResults } = await listTasks(owner.client, { dueDate: "today", excludeCompleted: true });
    expect(todayResults?.map((t) => t.id)).toEqual([anotherToday!.id]);

    const { data: upcomingResults } = await listTasks(owner.client, { dueDate: "upcoming" });
    expect(upcomingResults?.map((t) => t.title)).toEqual(["Due next week"]);
  });

  it("searches by title/description and sorts alphabetically", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-search@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    await createTask(owner.client, owner.userId, { title: "Zebra task" });
    await createTask(owner.client, owner.userId, { title: "Apple task", description: "buy fruit" });
    await createTask(owner.client, owner.userId, { title: "Unrelated" });

    const { data: searchResults } = await listTasks(owner.client, { search: "fruit" });
    expect(searchResults?.map((t) => t.title)).toEqual(["Apple task"]);

    const { data: sorted } = await listTasks(owner.client, { sort: "alphabetical" });
    expect(sorted?.map((t) => t.title)).toEqual(["Apple task", "Unrelated", "Zebra task"]);
  });

  it("sorts by priority highest-first (enum declaration order, not alphabetical)", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-sort-priority@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    // Created in a scrambled order so the result can't accidentally match
    // insertion order or alphabetical order.
    await createTask(owner.client, owner.userId, { title: "Medium task", priority: "MEDIUM" });
    await createTask(owner.client, owner.userId, { title: "Urgent task", priority: "URGENT" });
    await createTask(owner.client, owner.userId, { title: "Low task", priority: "LOW" });
    await createTask(owner.client, owner.userId, { title: "High task", priority: "HIGH" });

    const { data: sorted } = await listTasks(owner.client, { sort: "priority" });
    expect(sorted?.map((t) => t.priority)).toEqual(["URGENT", "HIGH", "MEDIUM", "LOW"]);
  });

  it("sorts by due_date ascending with nulls last", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-sort-duedate@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const soon = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    const later = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    await createTask(owner.client, owner.userId, { title: "No due date" });
    await createTask(owner.client, owner.userId, { title: "Later", dueDate: later });
    await createTask(owner.client, owner.userId, { title: "Soon", dueDate: soon });

    const { data: sorted } = await listTasks(owner.client, { sort: "due_date" });
    expect(sorted?.map((t) => t.title)).toEqual(["Soon", "Later", "No due date"]);
  });

  it("sorts by created_at descending (most recently created first)", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-sort-created@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: first } = await createTask(owner.client, owner.userId, { title: "First" });
    const { data: second } = await createTask(owner.client, owner.userId, { title: "Second" });

    const { data: sorted } = await listTasks(owner.client, { sort: "created_at" });
    const firstIndex = sorted!.findIndex((t) => t.id === first!.id);
    const secondIndex = sorted!.findIndex((t) => t.id === second!.id);
    expect(secondIndex).toBeLessThan(firstIndex);
  });

  it("filters to tasks with no due date via dueDate: 'none'", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-duedate-none@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    await createTask(owner.client, owner.userId, { title: "Has due date", dueDate: new Date().toISOString() });
    await createTask(owner.client, owner.userId, { title: "No due date" });

    const { data: noDueDateResults } = await listTasks(owner.client, { dueDate: "none" });
    expect(noDueDateResults?.map((t) => t.title)).toEqual(["No due date"]);
  });
});

describe("updateTaskPosition", () => {
  it("updates a task's position", async () => {
    const owner = await createConfirmedTestUser(admin, "tasks-position@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: task } = await createTask(owner.client, owner.userId, { title: "Reorder me" });
    const { error } = await updateTaskPosition(owner.client, task!.id, 42);
    expect(error).toBeNull();

    const { data: afterUpdate } = await listTasks(owner.client, {});
    const updated = afterUpdate?.find((t) => t.id === task!.id);
    expect(updated?.position).toBe(42);
  });
});
