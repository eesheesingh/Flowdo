import { describe, it, expect } from "vitest";
import { queryLocalDb } from "../helpers/pg-client";

describe("phase 3 migrations", () => {
  it("0007: tasks.recurrence column + enum", async () => {
    const col = await queryLocalDb(
      `select column_default, is_nullable from information_schema.columns
       where table_schema='flowdo' and table_name='tasks' and column_name='recurrence'`
    );
    expect(col.rows.length).toBe(1);
    expect(col.rows[0].column_default).toContain("NEVER");
    expect(col.rows[0].is_nullable).toBe("NO");

    const vals = await queryLocalDb(
      `select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
       where t.typname='recurrence_freq' order by enumsortorder`
    );
    expect(vals.rows.map((r) => r.enumlabel)).toEqual(
      ["NEVER", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"]
    );
  });

  it("0007: tasks.recurrence_rule is nullable jsonb", async () => {
    const col = await queryLocalDb(
      `select data_type, is_nullable from information_schema.columns
       where table_schema='flowdo' and table_name='tasks' and column_name='recurrence_rule'`
    );
    expect(col.rows[0]).toMatchObject({ data_type: "jsonb", is_nullable: "YES" });
  });

  it("0008: activity triggers exist on tasks and projects", async () => {
    const rows = await queryLocalDb(
      `select tgname, tgrelid::regclass::text as tbl from pg_trigger
       where tgname in ('log_task_activity','log_project_activity')`
    );
    const map = Object.fromEntries(rows.rows.map((r) => [r.tgname, r.tbl]));
    expect(map["log_task_activity"]).toBe("flowdo.tasks");
    expect(map["log_project_activity"]).toBe("flowdo.projects");
  });

  it("0008: activity trigger functions exist in flowdo schema", async () => {
    const rows = await queryLocalDb(
      `select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'flowdo' and proname in ('log_task_activity','log_project_activity')`
    );
    expect(rows.rows.map((r) => r.proname).sort()).toEqual(
      ["log_project_activity", "log_task_activity"]
    );
  });

  it("0009: deleting a user cascades through their own tasks/projects without error (regression)", async () => {
    // Migration 0008's triggers insert an activity_logs row attributed to
    // the acting user on every task/project delete. Deleting the user
    // themselves cascades to delete their own tasks/projects in the same
    // statement, so the trigger's insert used to hit a NOT NULL / ON DELETE
    // CASCADE foreign key against the very auth.users row being removed.
    const userId = "00000000-0000-4000-8000-000000000009";
    await queryLocalDb(`delete from auth.users where id = $1`, [userId]);
    await queryLocalDb(
      `insert into auth.users (id, email) values ($1, 'phase3-migration-0009@example.com')`,
      [userId]
    );
    const project = await queryLocalDb(
      `insert into flowdo.projects (owner_id, name) values ($1, 'cascade check') returning id`,
      [userId]
    );
    await queryLocalDb(
      `insert into flowdo.tasks (user_id, project_id, title) values ($1, $2, 'cascade check task')`,
      [userId, project.rows[0].id]
    );

    await expect(queryLocalDb(`delete from auth.users where id = $1`, [userId])).resolves.toBeDefined();

    const fk = await queryLocalDb(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'activity_logs_user_id_fkey'`
    );
    expect(fk.rows[0].def).toContain("ON DELETE SET NULL");
  });
});
