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
});
