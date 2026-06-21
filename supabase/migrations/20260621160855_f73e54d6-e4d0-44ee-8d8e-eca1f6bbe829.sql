
-- 1) Hide groups.join_code from non-owners via column-level grants
REVOKE SELECT ON public.groups FROM authenticated, anon;
GRANT SELECT (id, name, owner_id, created_at) ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

-- Keep join_code accessible to owner via dedicated RPC only; ensure owner can still read full row when needed
-- (Owner uses get_group_join_code RPC which is SECURITY DEFINER, so no extra grant required.)

-- 2) Hide profiles.email from authenticated; only owner/admin access via SECURITY DEFINER RPCs
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, display_name, avatar_url, group_id, group_name, created_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 3) Prevent admins from re-pointing a user_roles row to themselves (privilege escalation)
REVOKE UPDATE ON public.user_roles FROM authenticated, anon;
GRANT UPDATE (role) ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
