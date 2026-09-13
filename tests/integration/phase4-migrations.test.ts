import { describe, it, expect, afterAll } from "vitest";
import { queryLocalDb } from "../helpers/pg-client";

const OWNER_ID = "00000000-0000-4000-8000-000000000101";
const ADMIN_ID = "00000000-0000-4000-8000-000000000102";
const MEMBER_ID = "00000000-0000-4000-8000-000000000103";
const OUTSIDER_ID = "00000000-0000-4000-8000-000000000104";
const PROFILE_OWNER_ID = "00000000-0000-4000-8000-000000000201";
const PROFILE_MEMBER_ID = "00000000-0000-4000-8000-000000000202";
const PROFILE_STRANGER_ID = "00000000-0000-4000-8000-000000000203";
const LOOKUP_ID = "00000000-0000-4000-8000-000000000210";

async function asUser(userId: string, sql: string) {
  const results = (await queryLocalDb(
    `set local role authenticated;
     select set_config('request.jwt.claim.sub', '${userId}', true);
     ${sql}`
  )) as unknown as { rows: Record<string, unknown>[] }[];
  return results[results.length - 1]!;
}

describe("phase 4 migrations", () => {
  afterAll(async () => {
    await queryLocalDb(`delete from auth.users where id in ($1,$2,$3,$4,$5,$6,$7,$8)`, [
      OWNER_ID, ADMIN_ID, MEMBER_ID, OUTSIDER_ID,
      PROFILE_OWNER_ID, PROFILE_MEMBER_ID, PROFILE_STRANGER_ID, LOOKUP_ID,
    ]);
  });

  it("0012: project_members_update_admin lets an owner or admin change a member's role, but not a plain member", async () => {
    await queryLocalDb(`delete from auth.users where id in ($1,$2,$3)`, [OWNER_ID, ADMIN_ID, MEMBER_ID]);
    await queryLocalDb(
      `insert into auth.users (id, email) values
       ($1, 'phase4-owner@example.com'), ($2, 'phase4-admin@example.com'), ($3, 'phase4-member@example.com')`,
      [OWNER_ID, ADMIN_ID, MEMBER_ID]
    );
    const project = await queryLocalDb(
      `insert into flowdo.projects (owner_id, name) values ($1, 'role-update-test') returning id`,
      [OWNER_ID]
    );
    const projectId = project.rows[0]!.id;
    await queryLocalDb(
      `insert into flowdo.project_members (project_id, user_id, role) values
       ($1, $2, 'ADMIN'), ($1, $3, 'MEMBER')`,
      [projectId, ADMIN_ID, MEMBER_ID]
    );

    const asAdmin = await asUser(
      ADMIN_ID,
      `update flowdo.project_members set role = 'VIEWER' where project_id = '${projectId}' and user_id = '${MEMBER_ID}' returning role;`
    );
    expect(asAdmin.rows).toEqual([{ role: "VIEWER" }]);

    const asOwner = await asUser(
      OWNER_ID,
      `update flowdo.project_members set role = 'MEMBER' where project_id = '${projectId}' and user_id = '${ADMIN_ID}' returning role;`
    );
    expect(asOwner.rows).toEqual([{ role: "MEMBER" }]);

    const asMember = await asUser(
      MEMBER_ID,
      `update flowdo.project_members set role = 'ADMIN' where project_id = '${projectId}' and user_id = '${ADMIN_ID}' returning role;`
    );
    expect(asMember.rows).toEqual([]);
  });

  it("0012: a project member can select and insert the project's tasks; a non-member cannot", async () => {
    await queryLocalDb(`delete from auth.users where id in ($1,$2,$3)`, [OWNER_ID, MEMBER_ID, OUTSIDER_ID]);
    await queryLocalDb(
      `insert into auth.users (id, email) values
       ($1, 'phase4-owner2@example.com'), ($2, 'phase4-member2@example.com'), ($3, 'phase4-outsider@example.com')`,
      [OWNER_ID, MEMBER_ID, OUTSIDER_ID]
    );
    const project = await queryLocalDb(
      `insert into flowdo.projects (owner_id, name) values ($1, 'task-visibility-test') returning id`,
      [OWNER_ID]
    );
    const projectId = project.rows[0]!.id;
    await queryLocalDb(`insert into flowdo.project_members (project_id, user_id, role) values ($1, $2, 'MEMBER')`, [
      projectId,
      MEMBER_ID,
    ]);
    const task = await queryLocalDb(
      `insert into flowdo.tasks (user_id, project_id, title) values ($1, $2, 'owner task') returning id`,
      [OWNER_ID, projectId]
    );
    const taskId = task.rows[0]!.id;

    const memberSelect = await asUser(MEMBER_ID, `select id from flowdo.tasks where id = '${taskId}';`);
    expect(memberSelect.rows).toEqual([{ id: taskId }]);

    const outsiderSelect = await asUser(OUTSIDER_ID, `select id from flowdo.tasks where id = '${taskId}';`);
    expect(outsiderSelect.rows).toEqual([]);

    const memberInsert = await asUser(
      MEMBER_ID,
      `insert into flowdo.tasks (user_id, project_id, title) values ('${MEMBER_ID}', '${projectId}', 'member task') returning id;`
    );
    expect(memberInsert.rows).toHaveLength(1);

    await expect(
      queryLocalDb(
        `set local role authenticated;
         select set_config('request.jwt.claim.sub', '${OUTSIDER_ID}', true);
         insert into flowdo.tasks (user_id, project_id, title) values ('${OUTSIDER_ID}', '${projectId}', 'outsider task') returning id;`
      )
    ).rejects.toThrow();
  });

  it("0012: a VIEWER can see the project's tasks but cannot insert or update one", async () => {
    await queryLocalDb(`delete from auth.users where id in ($1,$2)`, [OWNER_ID, MEMBER_ID]);
    await queryLocalDb(
      `insert into auth.users (id, email) values
       ($1, 'phase4-owner3@example.com'), ($2, 'phase4-viewer@example.com')`,
      [OWNER_ID, MEMBER_ID]
    );
    const project = await queryLocalDb(
      `insert into flowdo.projects (owner_id, name) values ($1, 'viewer-readonly-test') returning id`,
      [OWNER_ID]
    );
    const projectId = project.rows[0]!.id;
    // MEMBER_ID is reused here as the VIEWER for this case -- a fresh id
    // constant isn't needed since each `it` block deletes and re-inserts
    // its own users before use.
    await queryLocalDb(`insert into flowdo.project_members (project_id, user_id, role) values ($1, $2, 'VIEWER')`, [
      projectId,
      MEMBER_ID,
    ]);
    const task = await queryLocalDb(
      `insert into flowdo.tasks (user_id, project_id, title) values ($1, $2, 'viewer can see this') returning id`,
      [OWNER_ID, projectId]
    );
    const taskId = task.rows[0]!.id;

    const viewerSelect = await asUser(MEMBER_ID, `select id from flowdo.tasks where id = '${taskId}';`);
    expect(viewerSelect.rows).toEqual([{ id: taskId }]);

    await expect(
      queryLocalDb(
        `set local role authenticated;
         select set_config('request.jwt.claim.sub', '${MEMBER_ID}', true);
         insert into flowdo.tasks (user_id, project_id, title) values ('${MEMBER_ID}', '${projectId}', 'viewer task') returning id;`
      )
    ).rejects.toThrow();

    // Unlike INSERT's WITH CHECK (which raises an error for a rejected row),
    // UPDATE's USING clause silently excludes a row RLS won't let the caller
    // touch -- it matches zero rows rather than throwing. Same shape as the
    // asMember case in the role-update test above.
    const viewerUpdate = await asUser(
      MEMBER_ID,
      `update flowdo.tasks set title = 'edited by viewer' where id = '${taskId}' returning id;`
    );
    expect(viewerUpdate.rows).toEqual([]);
  });

  it("0012: profiles_select_project_mate lets project mates see each other's profile, but not an unrelated user's", async () => {
    await queryLocalDb(`delete from auth.users where id in ($1,$2,$3)`, [
      PROFILE_OWNER_ID, PROFILE_MEMBER_ID, PROFILE_STRANGER_ID,
    ]);
    await queryLocalDb(
      `insert into auth.users (id, email) values
       ($1, 'phase4-profile-owner@example.com'), ($2, 'phase4-profile-member@example.com'), ($3, 'phase4-profile-stranger@example.com')`,
      [PROFILE_OWNER_ID, PROFILE_MEMBER_ID, PROFILE_STRANGER_ID]
    );
    const project = await queryLocalDb(
      `insert into flowdo.projects (owner_id, name) values ($1, 'profile-visibility-test') returning id`,
      [PROFILE_OWNER_ID]
    );
    const projectId = project.rows[0]!.id;
    await queryLocalDb(`insert into flowdo.project_members (project_id, user_id, role) values ($1, $2, 'MEMBER')`, [
      projectId,
      PROFILE_MEMBER_ID,
    ]);

    const memberSeesOwner = await asUser(PROFILE_MEMBER_ID, `select id from flowdo.profiles where id = '${PROFILE_OWNER_ID}';`);
    expect(memberSeesOwner.rows).toEqual([{ id: PROFILE_OWNER_ID }]);

    const ownerSeesMember = await asUser(PROFILE_OWNER_ID, `select id from flowdo.profiles where id = '${PROFILE_MEMBER_ID}';`);
    expect(ownerSeesMember.rows).toEqual([{ id: PROFILE_MEMBER_ID }]);

    const strangerSeesOwner = await asUser(PROFILE_STRANGER_ID, `select id from flowdo.profiles where id = '${PROFILE_OWNER_ID}';`);
    expect(strangerSeesOwner.rows).toEqual([]);
  });

  it("0012: find_user_id_by_email resolves an existing account and returns null otherwise", async () => {
    await queryLocalDb(`delete from auth.users where id = $1`, [LOOKUP_ID]);
    await queryLocalDb(`insert into auth.users (id, email) values ($1, 'phase4-lookup@example.com')`, [LOOKUP_ID]);

    const found = await queryLocalDb(`select flowdo.find_user_id_by_email('phase4-lookup@example.com') as id`);
    expect(found.rows[0]!.id).toBe(LOOKUP_ID);

    const missing = await queryLocalDb(`select flowdo.find_user_id_by_email('nobody-at-all@example.com') as id`);
    expect(missing.rows[0]!.id).toBeNull();
  });

  it("0012: find_user_id_by_email is not callable by the anonymous role", async () => {
    // Guards the REVOKE/GRANT in the migration -- without it, an
    // unauthenticated caller could enumerate registered emails.
    await expect(
      queryLocalDb(`set local role anon; select flowdo.find_user_id_by_email('phase4-lookup@example.com') as id;`)
    ).rejects.toThrow(/permission denied/i);
  });

  it("0013: flowdo.tasks and flowdo.activity_logs are in the supabase_realtime publication", async () => {
    const rows = await queryLocalDb(
      `select tablename from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'flowdo'`
    );
    expect(rows.rows.map((r) => r.tablename).sort()).toEqual(["activity_logs", "tasks"]);
  });
});
