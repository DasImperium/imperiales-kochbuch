
-- 1) Realtime: lock down broadcast/presence channels
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
-- No policies => default deny for anon/authenticated. service_role bypasses RLS.

-- 2) Revoke EXECUTE on internal trigger functions from everyone except service_role
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_superadmin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trim_list_snapshots() FROM PUBLIC, anon, authenticated;

-- 3) Revoke EXECUTE on SECURITY DEFINER RPCs/helpers from anon (authenticated keeps access)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.role_tier(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.same_group(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_list_access(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.group_member_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_recipe_tag(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_recipe_tag(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_group(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_group(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_group() FROM anon;
REVOKE EXECUTE ON FUNCTION public.regenerate_join_code(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_group_join_code(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_email() FROM anon;
