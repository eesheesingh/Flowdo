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
});
