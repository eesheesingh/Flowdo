-- flowdo.profiles.email is a denormalized copy of the auth user's email,
-- intended to be read (not written) by app features such as member lists,
-- sharing, and notifications. The blanket table-level UPDATE grant from
-- 0001_create_flowdo_schema.sql, combined with profiles_update_own's RLS
-- policy (which restricts WHICH ROW can be updated but not WHICH COLUMNS),
-- currently lets any authenticated user set their own email to an arbitrary
-- string via `update profiles set email = '...' where id = auth.uid()`.
-- The app's own updateProfile() only ever writes full_name, so restrict the
-- column-level grant to match: full_name and avatar_url only.
revoke update on flowdo.profiles from anon, authenticated;
grant update (full_name, avatar_url) on flowdo.profiles to authenticated;
