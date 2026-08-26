import { describe, it, expect } from "vitest";
import { queryLocalDb } from "../helpers/pg-client";

describe("flowdo schema", () => {
  it("creates the flowdo schema with all expected tables", async () => {
    const result = await queryLocalDb(
      `select table_name from information_schema.tables where table_schema = 'flowdo' order by table_name`
    );
    const tableNames = result.rows.map((r) => r.table_name);
    expect(tableNames).toEqual([
      "activity_logs",
      "labels",
      "notifications",
      "profiles",
      "project_members",
      "projects",
      "task_labels",
      "tasks",
    ]);
  });

  it("cascades task deletion to task_labels", async () => {
    await queryLocalDb(`delete from flowdo.profiles`); // clean slate for this test's inserts
    const user = await queryLocalDb(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'schema-test@example.com') returning id`
    );
    const userId = user.rows[0].id;
    const task = await queryLocalDb(
      `insert into flowdo.tasks (user_id, title) values ($1, 'test task') returning id`,
      [userId]
    );
    const label = await queryLocalDb(
      `insert into flowdo.labels (user_id, name) values ($1, 'test label') returning id`,
      [userId]
    );
    await queryLocalDb(`insert into flowdo.task_labels (task_id, label_id) values ($1, $2)`, [
      task.rows[0].id,
      label.rows[0].id,
    ]);
    await queryLocalDb(`delete from flowdo.tasks where id = $1`, [task.rows[0].id]);
    const remaining = await queryLocalDb(`select * from flowdo.task_labels where task_id = $1`, [
      task.rows[0].id,
    ]);
    expect(remaining.rows.length).toBe(0);
  });
});
