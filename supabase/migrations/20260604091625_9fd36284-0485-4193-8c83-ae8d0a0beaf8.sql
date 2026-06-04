
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  join_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS profiles_group_id_idx ON public.profiles(group_id);

DROP POLICY IF EXISTS members_see_group ON public.groups;
CREATE POLICY members_see_group ON public.groups FOR SELECT TO authenticated
USING (id IN (SELECT group_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS owner_update_group ON public.groups;
CREATE POLICY owner_update_group ON public.groups FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_delete_group ON public.groups;
CREATE POLICY owner_delete_group ON public.groups FOR DELETE TO authenticated
USING (owner_id = auth.uid());

REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, avatar_url, group_name, group_id, created_at)
  ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO service_role;

REVOKE UPDATE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, group_name, avatar_url) ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.same_group(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles pa
    JOIN public.profiles pb ON pb.group_id = pa.group_id
    WHERE pa.id = _a AND pb.id = _b AND pa.group_id IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.group_member_ids(_uid uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.profiles p
  WHERE p.group_id IS NOT NULL
    AND p.group_id = (SELECT group_id FROM public.profiles WHERE id = _uid)
  UNION SELECT _uid;
$$;

CREATE OR REPLACE FUNCTION public.create_group(_name text)
RETURNS public.groups LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.groups; code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  INSERT INTO public.groups(name, owner_id, join_code)
    VALUES (trim(_name), auth.uid(), code) RETURNING * INTO g;
  UPDATE public.profiles SET group_id = g.id WHERE id = auth.uid();
  RETURN g;
END; $$;

CREATE OR REPLACE FUNCTION public.join_group(_code text)
RETURNS public.groups LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.groups;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO g FROM public.groups WHERE join_code = upper(trim(_code));
  IF g.id IS NULL THEN RAISE EXCEPTION 'Beitrittscode ungültig'; END IF;
  UPDATE public.profiles SET group_id = g.id WHERE id = auth.uid();
  RETURN g;
END; $$;

CREATE OR REPLACE FUNCTION public.leave_group()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.profiles SET group_id = NULL WHERE id = auth.uid();
END; $$;

CREATE OR REPLACE FUNCTION public.regenerate_join_code(_group_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Nur Eigentümer darf Code erneuern';
  END IF;
  code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  UPDATE public.groups SET join_code = code WHERE id = _group_id;
  RETURN code;
END; $$;

CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE lower(email) = lower(trim(_email)) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, display_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.email FROM public.profiles p
  WHERE public.role_tier(auth.uid()) >= 2
  ORDER BY p.display_name;
$$;

GRANT EXECUTE ON FUNCTION
  public.create_group(text),
  public.join_group(text),
  public.leave_group(),
  public.regenerate_join_code(uuid),
  public.find_user_id_by_email(text),
  public.admin_list_users()
TO authenticated;
