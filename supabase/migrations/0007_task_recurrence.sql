create type flowdo.recurrence_freq as enum
  ('NEVER', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');

alter table flowdo.tasks
  add column recurrence flowdo.recurrence_freq not null default 'NEVER',
  add column recurrence_rule jsonb;
