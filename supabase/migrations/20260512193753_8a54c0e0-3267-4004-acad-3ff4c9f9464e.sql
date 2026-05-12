
-- 1) Enum erweitern (in eigener Anweisung; Werte werden erst in Folgemigration nutzbar)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'imperator';

-- 2) Helper: Rang-Stufe (1=user, 2=admin, 3=superadmin, 4=imperator)
CREATE OR REPLACE FUNCTION public.role_tier(_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(CASE role::text
    WHEN 'imperator' THEN 4
    WHEN 'superadmin' THEN 3
    WHEN 'admin' THEN 2
    WHEN 'user' THEN 1
    ELSE 0 END), 1)
  FROM public.user_roles WHERE user_id = _user_id;
$$;

-- 3) Rezepte: Soft-Delete und Schutz
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by_user uuid,
  ADD COLUMN IF NOT EXISTS deleted_by_tier int,
  ADD COLUMN IF NOT EXISTS protection_tier int NOT NULL DEFAULT 0;

-- Sichtbarkeitspolicy ersetzen: gelöschte Rezepte nur ab passender Rangstufe
DROP POLICY IF EXISTS recipes_select_all ON public.recipes;
CREATE POLICY recipes_select_visible ON public.recipes
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    OR public.role_tier(auth.uid()) >= COALESCE(deleted_by_tier, 99)
  );

-- 4) Hauptkategorie "Desserts" entfernen (nur falls leer)
DELETE FROM public.categories
WHERE is_root = true
  AND lower(name) = 'desserts'
  AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.category_id = categories.id);

-- 5) Inventar
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- 6) Einkaufsliste
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '',
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- 7) Freigaben
CREATE TABLE IF NOT EXISTS public.list_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  shared_with uuid NOT NULL,
  list_kind text NOT NULL CHECK (list_kind IN ('inventory','shopping')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, shared_with, list_kind)
);
ALTER TABLE public.list_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY list_shares_select ON public.list_shares
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = shared_with);
CREATE POLICY list_shares_owner_manage ON public.list_shares
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 8) Helper: ist Liste an mich freigegeben?
CREATE OR REPLACE FUNCTION public.has_list_access(_owner_id uuid, _kind text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() = _owner_id
      OR EXISTS (
        SELECT 1 FROM public.list_shares
        WHERE owner_id = _owner_id AND shared_with = auth.uid() AND list_kind = _kind
      );
$$;

-- 9) RLS Inventar / Einkaufsliste mit Sharing
CREATE POLICY inventory_access ON public.inventory_items
  FOR ALL TO authenticated
  USING (public.has_list_access(owner_id, 'inventory'))
  WITH CHECK (auth.uid() = owner_id OR public.has_list_access(owner_id, 'inventory'));

CREATE POLICY shopping_access ON public.shopping_items
  FOR ALL TO authenticated
  USING (public.has_list_access(owner_id, 'shopping'))
  WITH CHECK (auth.uid() = owner_id OR public.has_list_access(owner_id, 'shopping'));

-- 10) Versionshistorie (letzter Stand je Liste)
CREATE TABLE IF NOT EXISTS public.list_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  list_kind text NOT NULL CHECK (list_kind IN ('inventory','shopping')),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.list_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY list_snapshots_own ON public.list_snapshots
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 11) protect_superadmin → Imperator-Schutz
CREATE OR REPLACE FUNCTION public.protect_superadmin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND public.is_superadmin_user(OLD.user_id)
     AND OLD.role::text IN ('admin','superadmin','imperator') THEN
    DELETE FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('admin','superadmin','imperator')
        AND NOT public.is_superadmin_user(auth.uid());
    RAISE EXCEPTION 'Imperator-Schutz: Diese Rolle kann nicht entfernt werden';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS protect_superadmin_trigger ON public.user_roles;
CREATE TRIGGER protect_superadmin_trigger
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_superadmin();

-- 12) Updated-At Trigger für neue Tabellen
DROP TRIGGER IF EXISTS inv_updated ON public.inventory_items;
CREATE TRIGGER inv_updated BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS shop_updated ON public.shopping_items;
CREATE TRIGGER shop_updated BEFORE UPDATE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 13) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.list_shares;
