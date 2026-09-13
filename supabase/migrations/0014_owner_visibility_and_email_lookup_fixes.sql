-- Whole-branch review before merging phase 4 to main found four gaps left
-- by migration 0012, all stemming from the same documented invariant in that
-- migration's own comment block (section 3): the project OWNER never gets a
-- row in flowdo.project_members -- ownership is tracked solely via
-- flowdo.projects.owner_id. flowdo.is_project_member/is_project_admin only
-- ever check project_members, so anywhere a policy relies on those helpers
-- alone (without an explicit owner_id branch) the owner is silently
-- excluded from their own project's rows.
--
-- 1 (Critical): tasks_select_own/tasks_delete_own used only
--    is_project_member/is_project_admin, unlike tasks_insert_own/
--    tasks_update_own (same migration!) which already added the owner
--    branch. An owner could not see or delete a task a member created in
--    their own project. Fixed by copying the exact owner-branch shape from
--    insert/update.
--
-- 2 (Important): activity_logs_select_own (0003, broadened by 0009/0011)
--    never got a project-member branch at all -- only the acting user, the
--    referenced task's owner, and the referenced project's owner could see
--    a row. Additive: any project member (any role) can now see
--    activity_logs rows scoped to a project they belong to.
--
-- 3 (Important): task_labels_select_own (0003) never got a project-member
--    branch either -- only `t.user_id = auth.uid()` via the task join. A
--    member viewing a shared task couldn't see its labels. Additive: same
--    owner-or-member shape as tasks_select_own, applied through the task
--    each label belongs to.
--
-- 4 (Important): flowdo.find_user_id_by_email compared email = _email with
--    no case normalization. auth.users.email (and the profiles.email copy)
--    is stored lowercased by Supabase, but the function didn't lowercase
--    its input, so a correctly-typed but differently-cased invite email
--    (e.g. "Person@Example.com") would silently fail to resolve. Fixed with
--    lower() on both sides; signature unchanged.

drop policy "tasks_select_own" on flowdo.tasks;
create policy "tasks_select_own" on flowdo.tasks
  for select using (
    user_id = auth.uid()
    or (
      project_id is not null
      and (
        exists (select 1 from flowdo.projects p where p.id = tasks.project_id and p.owner_id = auth.uid())
        or flowdo.is_project_member(project_id)
      )
    )
  );

drop policy "tasks_delete_own" on flowdo.tasks;
create policy "tasks_delete_own" on flowdo.tasks
  for delete using (
    user_id = auth.uid()
    or (
      project_id is not null
      and (
        exists (select 1 from flowdo.projects p where p.id = tasks.project_id and p.owner_id = auth.uid())
        or flowdo.is_project_admin(project_id)
      )
    )
  );

drop policy "activity_logs_select_own" on flowdo.activity_logs;
create policy "activity_logs_select_own" on flowdo.activity_logs
  for select using (
    user_id = auth.uid()
    or (
      task_id is not null
      and exists (select 1 from flowdo.tasks t where t.id = activity_logs.task_id and t.user_id = auth.uid())
    )
    or (
      project_id is not null
      and exists (select 1 from flowdo.projects p where p.id = activity_logs.project_id and p.owner_id = auth.uid())
    )
    or (
      project_id is not null
      and flowdo.is_project_member(activity_logs.project_id)
    )
  );

drop policy "task_labels_select_own" on flowdo.task_labels;
create policy "task_labels_select_own" on flowdo.task_labels
  for select using (
    exists (select 1 from flowdo.tasks t where t.id = task_labels.task_id and t.user_id = auth.uid())
    or exists (
      select 1 from flowdo.tasks t
      where t.id = task_labels.task_id
        and t.project_id is not null
        and (
          exists (select 1 from flowdo.projects p where p.id = t.project_id and p.owner_id = auth.uid())
          or flowdo.is_project_member(t.project_id)
        )
    )
  );

create or replace function flowdo.find_user_id_by_email(_email text)
returns uuid
language sql
security definer
stable
set search_path = flowdo, public
as $$
  select id from flowdo.profiles where lower(email) = lower(_email);
$$;

revoke execute on function flowdo.find_user_id_by_email(text) from public;
grant execute on function flowdo.find_user_id_by_email(text) to authenticated;
