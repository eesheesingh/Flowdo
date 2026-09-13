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

  it("0011: activity_logs row with actor's user_id nulled stays visible to the current owner of its project", async () => {
    // Simulates a project member's activity surviving that member's account
    // deletion: the row's own user_id is null (as 0009 leaves it), but the
    // project it's about still exists and is still owned by A. Before 0011,
    // activity_logs_select_own only checked `user_id = auth.uid()`, so a
    // nulled row was unreadable by anyone, including A.
    const ownerId = "00000000-0000-4000-8000-000000000011";
    const strangerId = "00000000-0000-4000-8000-000000000012";
    await queryLocalDb(`delete from auth.users where id in ($1, $2)`, [ownerId, strangerId]);
    await queryLocalDb(
      `insert into auth.users (id, email) values
       ($1, 'phase3-migration-0011-owner@example.com'),
       ($2, 'phase3-migration-0011-stranger@example.com')`,
      [ownerId, strangerId]
    );
    const project = await queryLocalDb(
      `insert into flowdo.projects (owner_id, name) values ($1, 'owner-recovers-visibility') returning id`,
      [ownerId]
    );
    const projectId = project.rows[0].id;
    const log = await queryLocalDb(
      `insert into flowdo.activity_logs (user_id, task_id, project_id, action, metadata)
       values (null, null, $1, 'project.updated', '{}') returning id`,
      [projectId]
    );
    const logId = log.rows[0].id;

    // The project's current owner can now select the row as `authenticated`
    // with auth.uid() set to their id -- exercising RLS for real, not just
    // asserting the policy exists. set_config + the select must share one
    // implicit transaction with `set local role`, so this goes through as a
    // single multi-statement query rather than separate queryLocalDb calls.
    const asOwner = (await queryLocalDb(
      `set local role authenticated;
       select set_config('request.jwt.claim.sub', '${ownerId}', true);
       select id from flowdo.activity_logs where id = '${logId}';`
    )) as unknown as { rows: { id: string }[] }[];
    expect(asOwner[asOwner.length - 1]!.rows).toEqual([{ id: logId }]);

    // An unrelated user (not the project owner, not the nulled-out actor)
    // still can't see it -- the fix isn't a blanket grant.
    const asStranger = (await queryLocalDb(
      `set local role authenticated;
       select set_config('request.jwt.claim.sub', '${strangerId}', true);
       select id from flowdo.activity_logs where id = '${logId}';`
    )) as unknown as { rows: { id: string }[] }[];
    expect(asStranger[asStranger.length - 1]!.rows).toEqual([]);
  });

  it("0010: notifications.dedupe_key + insert policy", async () => {
    const col = await queryLocalDb(
      `select is_nullable from information_schema.columns
       where table_schema='flowdo' and table_name='notifications' and column_name='dedupe_key'`
    );
    expect(col.rows[0]?.is_nullable).toBe("YES");

    const policy = await queryLocalDb(
      `select policyname from pg_policies
       where schemaname='flowdo' and tablename='notifications' and policyname='notifications_insert_own'`
    );
    expect(policy.rows.length).toBe(1);
  });
});
