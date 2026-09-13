-- Project members (FLOWDO-4.7/4.8/4.9) is not a real feature with only the
-- table + insert/select/delete policies migration 0003 already shipped.
-- Four things are needed together to make it actually work end to end:
--
-- 1. project_members had no UPDATE policy: an admin/owner could invite
--    (project_members_insert_admin) and remove (project_members_delete_admin)
--    a member, but never change an existing member's role. This adds the
--    missing policy, in the exact owner-or-admin shape already used by
--    insert/delete.
--
-- 2. tasks_select_own / tasks_insert_own / tasks_update_own / tasks_delete_own
--    (0003) only ever checked `user_id = auth.uid()`, completely blind to
--    project membership. Joining a project granted zero visibility into or
--    control over that project's tasks. Shipping "project members" without
--    this would let someone join a project but never see or touch its
--    actual content -- a deliberate, necessary scope inclusion, not scope
--    creep. Broadened via the existing is_project_member/is_project_admin
--    helpers: SELECT for any member (any role, including VIEWER -- a viewer
--    should still see the project's tasks); INSERT/UPDATE for MEMBER/ADMIN/
--    OWNER only (a VIEWER is read-only by definition, so it must NOT be able
--    to create or edit tasks -- checked directly against project_members.role
--    since neither helper exposes a "member-or-above" tier); DELETE for
--    OWNER/ADMIN only.
--
-- 3. profiles_select_own (0003) only ever allowed `id = auth.uid()`. A
--    project's member list (FLOWDO-4.9) needs to show OTHER members' names/
--    emails, which that policy flatly refuses. Note that the project OWNER
--    has no project_members row at all (tracked solely via projects.owner_id
--    -- see tests/integration/rls.test.ts's "project_members recursion
--    guard" case, a deliberate existing invariant this migration does not
--    change), so the visibility rule has to be phrased in terms of BOTH
--    project_members rows and projects.owner_id, not project_members alone.
--    This does NOT open profiles up to every authenticated user (that would
--    break the existing "prevents a user from reading another user's
--    profile row" guarantee between unrelated users) -- only to people who
--    actually share a project.
--
-- 4. inviteMemberByEmail (FLOWDO-4.7) needs to find a FlowDo account by an
--    arbitrary email BEFORE that person is a project mate -- by definition,
--    (3)'s policy cannot help, since they don't share a project yet. Rather
--    than widening profiles SELECT further, expose only the minimum needed
--    fact ("does an account with this email exist, and what's its id")
--    through a SECURITY DEFINER function.
--
--    This is NOT the same shape as 0003's is_project_member/is_project_admin,
--    despite the surface similarity -- those are safe to leave executable by
--    anyone because they hardcode auth.uid(): an anonymous caller has no
--    auth.uid(), so they always get `false` and learn nothing. This function
--    takes an arbitrary caller-supplied email with no auth.uid() check at
--    all, so leaving it open to PUBLIC/anon would let an unauthenticated
--    caller enumerate which emails have FlowDo accounts. It is explicitly
--    revoked from PUBLIC and granted to `authenticated` only below -- the
--    caller must already have a session before they can probe an email, and
--    they already know the email (they typed it into the invite dialog);
--    this reveals nothing beyond whether that specific email has an account.

drop policy if exists "project_members_update_admin" on flowdo.project_members;
create policy "project_members_update_admin" on flowdo.project_members
  for update using (
    exists (
      select 1 from flowdo.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
    or flowdo.is_project_admin(project_id)
  ) with check (
    exists (
      select 1 from flowdo.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
    or flowdo.is_project_admin(project_id)
  );

drop policy "tasks_select_own" on flowdo.tasks;
create policy "tasks_select_own" on flowdo.tasks
  for select using (
    user_id = auth.uid()
    or (project_id is not null and flowdo.is_project_member(project_id))
  );

-- The plain `user_id = auth.uid()` escape hatch (kept for personal,
-- project-less tasks and for the true project owner -- projects.owner_id,
-- who per the recursion-guard invariant above has no project_members row of
-- their own) must NOT extend to an arbitrary other project: without gating
-- it on project_id being null or actually owned by the caller, any
-- authenticated caller -- including a VIEWER or a total non-member -- could
-- plant a task in someone else's project just by self-assigning user_id,
-- which would silently defeat the MEMBER/ADMIN/OWNER-only restriction below.
drop policy "tasks_insert_own" on flowdo.tasks;
create policy "tasks_insert_own" on flowdo.tasks
  for insert with check (
    (
      project_id is null
      and user_id = auth.uid()
    )
    or (
      project_id is not null
      and (
        exists (select 1 from flowdo.projects p where p.id = tasks.project_id and p.owner_id = auth.uid())
        or exists (
          select 1 from flowdo.project_members pm
          where pm.project_id = tasks.project_id and pm.user_id = auth.uid() and pm.role <> 'VIEWER'
        )
      )
    )
  );

-- USING keeps the plain user_id = auth.uid() branch unconditional: it only
-- decides which EXISTING rows are visible to update (a row you already own
-- is yours to touch regardless of project), so there's no project-attachment
-- exploit here the way there is in WITH CHECK below.
drop policy "tasks_update_own" on flowdo.tasks;
create policy "tasks_update_own" on flowdo.tasks
  for update using (
    user_id = auth.uid()
    or (
      project_id is not null
      and exists (
        select 1 from flowdo.project_members pm
        where pm.project_id = tasks.project_id and pm.user_id = auth.uid() and pm.role <> 'VIEWER'
      )
    )
  ) with check (
    (
      project_id is null
      and user_id = auth.uid()
    )
    or (
      project_id is not null
      and (
        exists (select 1 from flowdo.projects p where p.id = tasks.project_id and p.owner_id = auth.uid())
        or exists (
          select 1 from flowdo.project_members pm
          where pm.project_id = tasks.project_id and pm.user_id = auth.uid() and pm.role <> 'VIEWER'
        )
      )
    )
  );

drop policy "tasks_delete_own" on flowdo.tasks;
create policy "tasks_delete_own" on flowdo.tasks
  for delete using (
    user_id = auth.uid()
    or (project_id is not null and flowdo.is_project_admin(project_id))
  );

drop policy if exists "profiles_select_project_mate" on flowdo.profiles;
create policy "profiles_select_project_mate" on flowdo.profiles
  for select using (
    exists ( -- caller and target are both project_members rows of the same project
      select 1
      from flowdo.project_members mine
      join flowdo.project_members theirs on theirs.project_id = mine.project_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
    or exists ( -- caller OWNS a project the target is a member of
      select 1
      from flowdo.projects p
      join flowdo.project_members theirs on theirs.project_id = p.id
      where p.owner_id = auth.uid() and theirs.user_id = profiles.id
    )
    or exists ( -- target OWNS a project the caller is a member of
      select 1 from flowdo.projects p
      where p.owner_id = profiles.id and flowdo.is_project_member(p.id)
    )
  );

create or replace function flowdo.find_user_id_by_email(_email text)
returns uuid
language sql
security definer
stable
set search_path = flowdo, public
as $$
  select id from flowdo.profiles where email = _email;
$$;

-- Postgres functions are executable by PUBLIC by default, which under
-- Supabase includes the anon role. Restrict to authenticated so an
-- unauthenticated caller can't use this to enumerate registered emails.
revoke execute on function flowdo.find_user_id_by_email(text) from public;
grant execute on function flowdo.find_user_id_by_email(text) to authenticated;
