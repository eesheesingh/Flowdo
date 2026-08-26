create type flowdo.task_status as enum ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
create type flowdo.task_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
create type flowdo.member_role as enum ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

create or replace function flowdo.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table flowdo.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on flowdo.profiles
  for each row execute function flowdo.set_updated_at();

create or replace function flowdo.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = flowdo, public
as $$
begin
  insert into flowdo.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function flowdo.handle_new_user();

create table flowdo.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text not null default '#4F46E5',
  icon text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_id_idx on flowdo.projects (owner_id);
create trigger set_updated_at before update on flowdo.projects
  for each row execute function flowdo.set_updated_at();

create table flowdo.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references flowdo.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role flowdo.member_role not null default 'MEMBER',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_members_project_id_idx on flowdo.project_members (project_id);
create index project_members_user_id_idx on flowdo.project_members (user_id);

create table flowdo.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references flowdo.projects(id) on delete cascade,
  parent_task_id uuid references flowdo.tasks(id) on delete cascade,
  title text not null,
  description text,
  status flowdo.task_status not null default 'TODO',
  priority flowdo.task_priority not null default 'MEDIUM',
  due_date timestamptz,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_id_idx on flowdo.tasks (user_id);
create index tasks_project_id_idx on flowdo.tasks (project_id);
create index tasks_parent_task_id_idx on flowdo.tasks (parent_task_id);
create index tasks_due_date_idx on flowdo.tasks (due_date);
create index tasks_status_idx on flowdo.tasks (status);
create trigger set_updated_at before update on flowdo.tasks
  for each row execute function flowdo.set_updated_at();

create table flowdo.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#4F46E5',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index labels_user_id_idx on flowdo.labels (user_id);

create table flowdo.task_labels (
  task_id uuid not null references flowdo.tasks(id) on delete cascade,
  label_id uuid not null references flowdo.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create index task_labels_label_id_idx on flowdo.task_labels (label_id);

create table flowdo.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references flowdo.tasks(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on flowdo.notifications (user_id);

create table flowdo.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references flowdo.tasks(id) on delete set null,
  project_id uuid references flowdo.projects(id) on delete set null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_user_id_idx on flowdo.activity_logs (user_id);
