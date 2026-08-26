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

create policy "projects_select_member" on flowdo.projects
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from flowdo.project_members pm
      where pm.project_id = projects.id and pm.user_id = auth.uid()
    )
  );
create policy "projects_insert_own" on flowdo.projects
  for insert with check (owner_id = auth.uid());
create policy "projects_update_admin" on flowdo.projects
  for update using (
    owner_id = auth.uid()
    or exists (
      select 1 from flowdo.project_members pm
      where pm.project_id = projects.id and pm.user_id = auth.uid() and pm.role in ('OWNER', 'ADMIN')
    )
  ) with check (
    owner_id = auth.uid()
    or exists (
      select 1 from flowdo.project_members pm
      where pm.project_id = projects.id and pm.user_id = auth.uid() and pm.role in ('OWNER', 'ADMIN')
    )
  );
create policy "projects_delete_owner" on flowdo.projects
  for delete using (owner_id = auth.uid());

create policy "project_members_select_same_project" on flowdo.project_members
  for select using (
    exists (
      select 1 from flowdo.project_members pm2
      where pm2.project_id = project_members.project_id and pm2.user_id = auth.uid()
    )
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
    or exists (
      select 1 from flowdo.project_members pm2
      where pm2.project_id = project_members.project_id and pm2.user_id = auth.uid() and pm2.role in ('OWNER', 'ADMIN')
    )
  );
create policy "project_members_delete_admin" on flowdo.project_members
  for delete using (
    exists (
      select 1 from flowdo.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from flowdo.project_members pm2
      where pm2.project_id = project_members.project_id and pm2.user_id = auth.uid() and pm2.role in ('OWNER', 'ADMIN')
    )
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
