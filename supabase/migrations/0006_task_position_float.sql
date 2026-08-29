alter table flowdo.tasks
  alter column position type double precision using position::double precision;
