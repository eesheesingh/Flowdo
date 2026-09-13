-- 0009 made activity_logs.user_id nullable (set null when the acting user's
-- account is deleted) so account deletion doesn't FK-violate through a
-- user's own tasks/projects. But activity_logs_select_own only allowed
-- `user_id = auth.uid()`, so once a row's user_id is nulled it became
-- permanently unreadable by anyone -- including the current owner of the
-- task/project the row is actually about, even though that task/project
-- still exists.
--
-- Neither flowdo.tasks nor flowdo.activity_logs grant project-member
-- visibility anywhere else in this schema: a task is only ever visible to
-- its own user_id owner. So activity_logs.user_id for any task-related row
-- always equals that task's current user_id while the task exists -- adding
-- "the current owner of the referenced task/project can see it" is not a
-- new privilege, it's recovering the exact access the nulled user_id used
-- to grant, for rows whose task/project outlived the original actor's
-- account (e.g. a project member's activity, after that member's account is
-- deleted, remains visible to the project's owner).
--
-- Rows from a *.deleted event have task_id/project_id nulled unconditionally
-- (by design) and stay genuinely orphaned either way -- nothing to recover
-- there, the referenced object is gone.

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
  );
