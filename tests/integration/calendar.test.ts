import { describe, it, expect, afterEach } from "vitest";
import { createAdminClient } from "../helpers/admin-client";
import { createConfirmedTestUser } from "../helpers/test-user";
import { createTask, listTasks } from "@/lib/tasks/tasks";
import { monthRange } from "@/lib/calendar/month";

const admin = createAdminClient();
const createdUserIds: string[] = [];
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe("calendar dueDateRange filter", () => {
  it("returns only tasks whose due_date is inside the padded month grid", async () => {
    const owner = await createConfirmedTestUser(admin, "calendar-range@example.com", "Password123!");
    createdUserIds.push(owner.userId);

    await createTask(owner.client, owner.userId, { title: "In March", dueDate: "2026-03-10T09:00:00.000Z" });
    await createTask(owner.client, owner.userId, { title: "In June", dueDate: "2026-06-10T09:00:00.000Z" });
    await createTask(owner.client, owner.userId, { title: "No due date" });

    const { data } = await listTasks(owner.client, { dueDateRange: monthRange(2026, 3), parentTaskId: null });
    expect(data?.map((t) => t.title)).toEqual(["In March"]);
  });
});
