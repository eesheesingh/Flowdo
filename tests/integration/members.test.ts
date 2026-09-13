import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createProject } from "@/lib/projects/projects";
import { listMembers, inviteMemberByEmail, updateMemberRole, removeMember } from "@/lib/projects/members";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("project members", () => {
  it("an owner invites an existing user by email and sees them in the member list alongside themselves", async () => {
    const owner = await createConfirmedTestUser(admin, "members-owner@example.com", "Password123!");
    const invitee = await createConfirmedTestUser(admin, "members-invitee@example.com", "Password123!");
    createdUserIds.push(owner.userId, invitee.userId);

    const { data: project } = await createProject(owner.client, owner.userId, { name: "Shared", color: "#4F46E5", icon: "folder" });
    const { data: member, error } = await inviteMemberByEmail(owner.client, project!.id, "members-invitee@example.com", "MEMBER");
    expect(error).toBeNull();
    expect(member?.user_id).toBe(invitee.userId);

    const { data: members } = await listMembers(owner.client, project!.id);
    expect(members?.map((m) => ({ user_id: m.user_id, role: m.role }))).toEqual([
      { user_id: owner.userId, role: "OWNER" },
      { user_id: invitee.userId, role: "MEMBER" },
    ]);
    expect(members?.[0]?.profile?.email).toBe("members-owner@example.com");
    expect(members?.[1]?.profile?.email).toBe("members-invitee@example.com");
  });

  it("returns a human error when the email has no FlowDo account", async () => {
    const owner = await createConfirmedTestUser(admin, "members-owner2@example.com", "Password123!");
    createdUserIds.push(owner.userId);
    const { data: project } = await createProject(owner.client, owner.userId, { name: "Solo", color: "#4F46E5", icon: "folder" });

    const { data, error } = await inviteMemberByEmail(owner.client, project!.id, "nobody@example.com", "MEMBER");
    expect(data).toBeNull();
    expect(error).toBe("No FlowDo account found with that email.");
  });

  it("a plain member cannot invite, change roles, or remove members", async () => {
    const owner = await createConfirmedTestUser(admin, "members-owner3@example.com", "Password123!");
    const member = await createConfirmedTestUser(admin, "members-member3@example.com", "Password123!");
    const target = await createConfirmedTestUser(admin, "members-target3@example.com", "Password123!");
    createdUserIds.push(owner.userId, member.userId, target.userId);

    const { data: project } = await createProject(owner.client, owner.userId, { name: "Guarded", color: "#4F46E5", icon: "folder" });
    await inviteMemberByEmail(owner.client, project!.id, "members-member3@example.com", "MEMBER");
    await inviteMemberByEmail(owner.client, project!.id, "members-target3@example.com", "VIEWER");

    const { error: inviteError } = await inviteMemberByEmail(member.client, project!.id, "members-owner3@example.com", "MEMBER");
    expect(inviteError).not.toBeNull();

    await updateMemberRole(member.client, project!.id, target.userId, "ADMIN");
    const { data: afterRoleAttempt } = await listMembers(owner.client, project!.id);
    expect(afterRoleAttempt?.find((m) => m.user_id === target.userId)?.role).toBe("VIEWER");

    await removeMember(member.client, project!.id, target.userId);
    const { data: afterRemoveAttempt } = await listMembers(owner.client, project!.id);
    expect(afterRemoveAttempt?.some((m) => m.user_id === target.userId)).toBe(true);
  });

  it("an admin can change a member's role and remove a member", async () => {
    const owner = await createConfirmedTestUser(admin, "members-owner4@example.com", "Password123!");
    const projectAdmin = await createConfirmedTestUser(admin, "members-admin4@example.com", "Password123!");
    const target = await createConfirmedTestUser(admin, "members-target4@example.com", "Password123!");
    createdUserIds.push(owner.userId, projectAdmin.userId, target.userId);

    const { data: project } = await createProject(owner.client, owner.userId, { name: "Adminable", color: "#4F46E5", icon: "folder" });
    await inviteMemberByEmail(owner.client, project!.id, "members-admin4@example.com", "ADMIN");
    await inviteMemberByEmail(owner.client, project!.id, "members-target4@example.com", "MEMBER");

    const { error: roleError } = await updateMemberRole(projectAdmin.client, project!.id, target.userId, "VIEWER");
    expect(roleError).toBeNull();
    const { data: afterRole } = await listMembers(owner.client, project!.id);
    expect(afterRole?.find((m) => m.user_id === target.userId)?.role).toBe("VIEWER");

    const { error: removeError } = await removeMember(projectAdmin.client, project!.id, target.userId);
    expect(removeError).toBeNull();
    const { data: afterRemove } = await listMembers(owner.client, project!.id);
    expect(afterRemove?.some((m) => m.user_id === target.userId)).toBe(false);
  });
});
