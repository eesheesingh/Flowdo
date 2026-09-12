alter table flowdo.notifications add column dedupe_key text;

create unique index notifications_user_dedupe_key_idx
  on flowdo.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create policy "notifications_insert_own" on flowdo.notifications
  for insert with check (user_id = auth.uid());
