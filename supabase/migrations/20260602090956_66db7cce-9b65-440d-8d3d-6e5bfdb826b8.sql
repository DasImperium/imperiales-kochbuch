
-- Group-based sync for inventory & shopping
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS group_name text;
CREATE INDEX IF NOT EXISTS idx_profiles_group_name ON public.profiles(lower(group_name));

CREATE OR REPLACE FUNCTION public.same_group(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles pa
    JOIN public.profiles pb ON lower(trim(pb.group_name)) = lower(trim(pa.group_name))
    WHERE pa.id = _a AND pb.id = _b
      AND pa.group_name IS NOT NULL AND trim(pa.group_name) <> ''
  );
$$;

CREATE OR REPLACE FUNCTION public.group_member_ids(_uid uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id FROM public.profiles p
  WHERE lower(trim(p.group_name)) = (
    SELECT lower(trim(group_name)) FROM public.profiles WHERE id = _uid
  )
  AND p.group_name IS NOT NULL AND trim(p.group_name) <> ''
  UNION SELECT _uid;
$$;

-- Update has_list_access to also allow same-group members
CREATE OR REPLACE FUNCTION public.has_list_access(_owner_id uuid, _kind text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() = _owner_id
      OR EXISTS (
        SELECT 1 FROM public.list_shares
        WHERE owner_id = _owner_id AND shared_with = auth.uid() AND list_kind = _kind
      )
      OR public.same_group(auth.uid(), _owner_id);
$$;
