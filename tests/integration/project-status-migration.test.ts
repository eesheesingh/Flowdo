import { describe, it, expect } from "vitest";
import { queryLocalDb } from "../helpers/pg-client";

describe("projects.status column", () => {
  it("exists with the expected enum values and defaults to ACTIVE", async () => {
    const columns = await queryLocalDb(
      `select column_name, column_default from information_schema.columns where table_schema = 'flowdo' and table_name = 'projects' and column_name = 'status'`
    );
    expect(columns.rows.length).toBe(1);
    expect(columns.rows[0].column_default).toContain("ACTIVE");

    const enumValues = await queryLocalDb(
      `select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'project_status' order by enumsortorder`
    );
    expect(enumValues.rows.map((r) => r.enumlabel)).toEqual(["ACTIVE", "ARCHIVED"]);
  });
});
