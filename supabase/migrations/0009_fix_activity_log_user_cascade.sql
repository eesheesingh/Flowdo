-- Fix: deleting a user account cascades to delete their own tasks/projects,
-- which fires the activity-log triggers from migration 0008. Those triggers
-- insert an activity_logs row attributed to that same user (user_id), but by
-- the time the cascade reaches the task/project delete, the auth.users row
-- being deleted is already gone from the FK's point of view within the same
-- statement, so activity_logs_user_id_fkey (NOT NULL, ON DELETE CASCADE)
-- rejects the insert with a foreign key violation — breaking account
-- deletion entirely whenever the user owns any task or project.
--
-- Fix: allow user_id to be null, switch its FK to ON DELETE SET NULL (so a
-- user's past activity survives their account being deleted, consistent
-- with how task_id/project_id already null themselves out), and have the
-- trigger functions fall back to null when the acting user no longer exists
-- at insert time.

alter table flowdo.activity_logs alter column user_id drop not null;

alter table flowdo.activity_logs
  drop constraint activity_logs_user_id_fkey,
  add constraint activity_logs_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;

create or replace function flowdo.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path to 'flowdo', 'public'
as $$
declare
  v_action text;
  v_user   uuid := coalesce(new.user_id, old.user_id);
begin
  if not exists (select 1 from auth.users u where u.id = v_user) then
    v_user := null;
  end if;

  if (tg_op = 'INSERT') then
    v_action := 'task.created';
  elsif (tg_op = 'DELETE') then
    v_action := 'task.deleted';
  elsif (new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED') then
    v_action := 'task.completed';
  elsif (old.status = 'COMPLETED' and new.status is distinct from 'COMPLETED') then
    v_action := 'task.reopened';
  else
    v_action := 'task.updated';
  end if;

  insert into flowdo.activity_logs (user_id, task_id, project_id, action, metadata)
  values (
    v_user,
    case when tg_op = 'DELETE' then null else new.id end,
    case when tg_op = 'DELETE' then null else new.project_id end,
    v_action,
    case
      when tg_op = 'DELETE' then jsonb_build_object('task_id', old.id, 'title', old.title)
      else jsonb_build_object('title', new.title)
    end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function flowdo.log_project_activity()
returns trigger
language plpgsql
security definer
set search_path to 'flowdo', 'public'
as $$
declare
  v_action text;
  v_user   uuid := coalesce(new.owner_id, old.owner_id);
begin
  if not exists (select 1 from auth.users u where u.id = v_user) then
    v_user := null;
  end if;

  if (tg_op = 'INSERT') then
    v_action := 'project.created';
  elsif (tg_op = 'DELETE') then
    v_action := 'project.deleted';
  elsif (new.status = 'ARCHIVED' and old.status is distinct from 'ARCHIVED') then
    v_action := 'project.archived';
  else
    v_action := 'project.updated';
  end if;

  insert into flowdo.activity_logs (user_id, task_id, project_id, action, metadata)
  values (
    v_user,
    null,
    case when tg_op = 'DELETE' then null else new.id end,
    v_action,
    case
      when tg_op = 'DELETE' then jsonb_build_object('project_id', old.id, 'name', old.name)
      else jsonb_build_object('name', new.name)
    end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
