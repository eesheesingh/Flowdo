create schema if not exists flowdo;

grant usage on schema flowdo to anon, authenticated, service_role;
alter default privileges in schema flowdo
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema flowdo
  grant usage, select on sequences to anon, authenticated, service_role;
