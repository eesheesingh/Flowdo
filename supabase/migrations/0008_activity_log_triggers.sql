create or replace function flowdo.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = flowdo, public
as $$
declare
  v_action text;
  v_user   uuid := coalesce(new.user_id, old.user_id);
begin
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

create trigger log_task_activity
  after insert or update or delete on flowdo.tasks
  for each row execute function flowdo.log_task_activity();

create or replace function flowdo.log_project_activity()
returns trigger
language plpgsql
security definer
set search_path = flowdo, public
as $$
declare
  v_action text;
  v_user   uuid := coalesce(new.owner_id, old.owner_id);
begin
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

create trigger log_project_activity
  after insert or update or delete on flowdo.projects
  for each row execute function flowdo.log_project_activity();
