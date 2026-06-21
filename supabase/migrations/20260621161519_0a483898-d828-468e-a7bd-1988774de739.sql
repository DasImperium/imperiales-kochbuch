
-- Trigger-only functions: revoke from PUBLIC completely (only service_role / trigger context needs them)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_superadmin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trim_list_snapshots() FROM PUBLIC;

-- App / helper functions: revoke PUBLIC, grant authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_superadmin_user(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_superadmin_user(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.role_tier(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.role_tier(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.same_group(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.same_group(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_list_access(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_list_access(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.group_member_ids(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.group_member_ids(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.add_recipe_tag(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.add_recipe_tag(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remove_recipe_tag(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.remove_recipe_tag(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_group(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_group(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.join_group(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.join_group(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.leave_group() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.leave_group() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.regenerate_join_code(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.regenerate_join_code(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_group_join_code(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_group_join_code(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_email() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_email() TO authenticated;
