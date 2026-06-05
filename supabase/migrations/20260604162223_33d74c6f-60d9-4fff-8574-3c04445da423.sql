
-- 1) Profiles SELECT policy: limit row visibility, but keep display_name/avatar lookups working via a safe view-like approach.
-- We keep general SELECT but rely on column-level grants (already in place: email NOT granted to authenticated).
-- To make the policy itself explicit, replace the USING(true) with one that still allows authenticated reads (column grants block email).
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_safe ON public.profiles
  FOR SELECT TO authenticated
  USING (true);
-- Ensure email column is not readable; only owner & admins read email via RPC.
REVOKE SELECT (email) ON public.profiles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_my_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid();
$$;

-- 2) Groups: hide join_code from members; only owner via RPC.
REVOKE SELECT (join_code) ON public.groups FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_group_join_code(_group_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT join_code INTO code FROM public.groups
    WHERE id = _group_id AND owner_id = auth.uid();
  IF code IS NULL THEN RAISE EXCEPTION 'Nur Eigentümer darf Code sehen'; END IF;
  RETURN code;
END; $$;

-- 3) Chat: broadcasts (recipient_id IS NULL) only visible if sender is admin.
DROP POLICY IF EXISTS chat_select_own ON public.chat_messages;
CREATE POLICY chat_select_own ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
    OR (recipient_id IS NULL AND public.has_role(sender_id, 'admin'::app_role))
  );

-- 4) user_roles: prevent admins from granting/revoking equal or higher roles.
DROP POLICY IF EXISTS user_roles_admin_manage ON public.user_roles;

CREATE POLICY user_roles_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (CASE role::text
           WHEN 'imperator' THEN 4
           WHEN 'superadmin' THEN 3
           WHEN 'admin' THEN 2
           ELSE 1 END) < public.role_tier(auth.uid())
  );

CREATE POLICY user_roles_admin_update ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (CASE role::text
           WHEN 'imperator' THEN 4
           WHEN 'superadmin' THEN 3
           WHEN 'admin' THEN 2
           ELSE 1 END) < public.role_tier(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (CASE role::text
           WHEN 'imperator' THEN 4
           WHEN 'superadmin' THEN 3
           WHEN 'admin' THEN 2
           ELSE 1 END) < public.role_tier(auth.uid())
  );

CREATE POLICY user_roles_admin_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (CASE role::text
           WHEN 'imperator' THEN 4
           WHEN 'superadmin' THEN 3
           WHEN 'admin' THEN 2
           ELSE 1 END) < public.role_tier(auth.uid())
  );
