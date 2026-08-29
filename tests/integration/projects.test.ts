import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createProject, updateProject, archiveProject, listProjects, getProject } from "@/lib/projects/projects";
import { createTask, listTasks } from "@/lib/tasks/tasks";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("createProject / updateProject", () => {
  it("creates a project owned by the caller and can update it", async () => {
    const owner = await createConfirmedTestUser(admin, "projects-create@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data, error } = await createProject(owner.client, owner.userId, {
      name: "Website Redesign",
      color: "#4F46E5",
      icon: "folder",
    });
    expect(error).toBeNull();
    expect(data?.status).toBe("ACTIVE");

    const { data: updated, error: updateError } = await updateProject(owner.client, data!.id, { name: "Website v2" });
    expect(updateError).toBeNull();
    expect(updated?.name).toBe("Website v2");
  });

  it("a different user cannot see or modify the project (RLS through the application layer)", async () => {
    const owner = await createConfirmedTestUser(admin, "projects-owner@example.com", "Password123!");
    const attacker = await createConfirmedTestUser(admin, "projects-attacker@example.com", "Password123!");
    createdUserIds.push(owner.userId, attacker.userId);

    const { data: project } = await createProject(owner.client, owner.userId, {
      name: "Private project",
      color: "#4F46E5",
      icon: "folder",
    });

    const { data: attackerView } = await listProjects(attacker.client);
    expect(attackerView?.find((p) => p.id === project!.id)).toBeUndefined();
  });
});

describe("archiveProject / listProjects", () => {
  it("hides an archived project from listProjects but keeps its tasks queryable", async () => {
    const owner = await createConfirmedTestUser(admin, "projects-archive@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    const { data: project } = await createProject(owner.client, owner.userId, {
      name: "Old project",
      color: "#4F46E5",
      icon: "folder",
    });
    await createTask(owner.client, owner.userId, { title: "Task in old project", projectId: project!.id });

    const { error } = await archiveProject(owner.client, project!.id);
    expect(error).toBeNull();

    const { data: activeProjects } = await listProjects(owner.client);
    expect(activeProjects?.find((p) => p.id === project!.id)).toBeUndefined();

    const { data: allProjects } = await listProjects(owner.client, { includeArchived: true });
    expect(allProjects?.find((p) => p.id === project!.id)?.status).toBe("ARCHIVED");

    const { data: directFetch } = await getProject(owner.client, project!.id);
    expect(directFetch?.id).toBe(project!.id);

    const { data: tasksInProject } = await listTasks(owner.client, { projectId: project!.id });
    expect(tasksInProject?.map((t) => t.title)).toEqual(["Task in old project"]);
  });
});
