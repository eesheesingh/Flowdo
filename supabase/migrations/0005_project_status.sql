create type flowdo.project_status as enum ('ACTIVE', 'ARCHIVED');

alter table flowdo.projects
  add column status flowdo.project_status not null default 'ACTIVE';
