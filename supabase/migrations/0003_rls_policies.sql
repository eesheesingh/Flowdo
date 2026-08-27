alter table flowdo.profiles enable row level security;
alter table flowdo.projects enable row level security;
alter table flowdo.project_members enable row level security;
alter table flowdo.tasks enable row level security;
alter table flowdo.labels enable row level security;
alter table flowdo.task_labels enable row level security;
alter table flowdo.notifications enable row level security;
alter table flowdo.activity_logs enable row level security;

create policy "profiles_select_own" on flowdo.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on flowdo.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "tasks_select_own" on flowdo.tasks
  for select using (user_id = auth.uid());
create policy "tasks_insert_own" on flowdo.tasks
  for insert with check (user_id = auth.uid());
create policy "tasks_update_own" on flowdo.tasks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tasks_delete_own" on flowdo.tasks
  for delete using (user_id = auth.uid());

create policy "labels_select_own" on flowdo.labels
  for select using (user_id = auth.uid());
create policy "labels_insert_own" on flowdo.labels
  for insert with check (user_id = auth.uid());
create policy "labels_update_own" on flowdo.labels
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "labels_delete_own" on flowdo.labels
  for delete using (user_id = auth.uid());

-- Helper functions to avoid recursive RLS policy evaluation: a policy ON
-- project_members that queries project_members directly causes Postgres
-- error 42P17 "infinite recursion detected in policy". SECURITY DEFINER
-- functions run as their owner (the migration role, which owns the table
-- and therefore bypasses its own RLS), so calling one from a policy breaks
-- the cycle instead of re-triggering it.
create or replace function flowdo.is_project_member(_project_id uuid, _user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = flowdo, public
as $$
  select exists (
    select 1 from flowdo.project_members
    where project_id = _project_id and user_id = _user_id
  );
$$;

create or replace function flowdo.is_project_admin(_project_id uuid, _user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = flowdo, public
as $$
  select exists (
    select 1 from flowdo.project_members
    where project_id = _project_id and user_id = _user_id and role in ('OWNER', 'ADMIN')
  );
$$;

-- RLS's WITH CHECK only sees the proposed new row, not the old one, so it
-- cannot by itself stop an ADMIN (non-owner) from reassigning owner_id while
-- otherwise legitimately updating a project. A trigger has both OLD and NEW.
create or replace function flowdo.prevent_unauthorized_owner_change()
returns trigger
language plpgsql
security definer
set search_path = flowdo, public
as $$
begin
  if new.owner_id is distinct from old.owner_id and old.owner_id <> auth.uid() then
    raise exception 'Only the current project owner can transfer ownership';
  end if;
  return new;
end;
$$;

create trigger prevent_unauthorized_owner_change
  before update on flowdo.projects
  for each row execute function flowdo.prevent_unauthorized_owner_change();

create policy "projects_select_member" on flowdo.projects
  for select using (
    owner_id = auth.uid()
    or flowdo.is_project_member(id, auth.uid())
  );
create policy "projects_insert_own" on flowdo.projects
  for insert with check (owner_id = auth.uid());
create policy "projects_update_admin" on flowdo.projects
  for update using (
    owner_id = auth.uid()
    or flowdo.is_project_admin(id, auth.uid())
  ) with check (
    owner_id = auth.uid()
    or flowdo.is_project_admin(id, auth.uid())
  );
create policy "projects_delete_owner" on flowdo.projects
  for delete using (owner_id = auth.uid());

create policy "project_members_select_same_project" on flowdo.project_members
  for select using (
    flowdo.is_project_member(project_id, auth.uid())
    or exists (
      select 1 from flowdo.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
  );
create policy "project_members_insert_admin" on flowdo.project_members
  for insert with check (
    exists (
      select 1 from flowdo.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
    or flowdo.is_project_admin(project_id, auth.uid())
  );
create policy "project_members_delete_admin" on flowdo.project_members
  for delete using (
    exists (
      select 1 from flowdo.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
    or flowdo.is_project_admin(project_id, auth.uid())
  );

create policy "task_labels_select_own" on flowdo.task_labels
  for select using (
    exists (select 1 from flowdo.tasks t where t.id = task_labels.task_id and t.user_id = auth.uid())
  );
create policy "task_labels_insert_own" on flowdo.task_labels
  for insert with check (
    exists (select 1 from flowdo.tasks t where t.id = task_labels.task_id and t.user_id = auth.uid())
    and exists (select 1 from flowdo.labels l where l.id = task_labels.label_id and l.user_id = auth.uid())
  );
create policy "task_labels_delete_own" on flowdo.task_labels
  for delete using (
    exists (select 1 from flowdo.tasks t where t.id = task_labels.task_id and t.user_id = auth.uid())
  );

create policy "notifications_select_own" on flowdo.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on flowdo.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete_own" on flowdo.notifications
  for delete using (user_id = auth.uid());

create policy "activity_logs_select_own" on flowdo.activity_logs
  for select using (user_id = auth.uid());
