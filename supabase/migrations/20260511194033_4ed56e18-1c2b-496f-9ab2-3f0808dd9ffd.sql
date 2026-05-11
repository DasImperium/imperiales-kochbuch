
-- 1) Servings column on recipes
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS servings integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS servings_unit text NOT NULL DEFAULT 'Personen';

-- 2) Ensure five fixed root categories (idempotent)
INSERT INTO public.categories (name, is_root, parent_id, created_by)
SELECT v.name, true, NULL, NULL
FROM (VALUES ('Kochen'),('Backen'),('Salate'),('Desserts'),('Getränke')) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.is_root = true AND lower(c.name) = lower(v.name)
);

-- 3) Menus
CREATE TABLE IF NOT EXISTS public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menus_select_all ON public.menus;
CREATE POLICY menus_select_all ON public.menus FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS menus_insert_own ON public.menus;
CREATE POLICY menus_insert_own ON public.menus FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS menus_update_own_or_admin ON public.menus;
CREATE POLICY menus_update_own_or_admin ON public.menus FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS menus_delete_own_or_admin ON public.menus;
CREATE POLICY menus_delete_own_or_admin ON public.menus FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS menus_set_updated_at ON public.menus;
CREATE TRIGGER menus_set_updated_at BEFORE UPDATE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Menu items
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL,
  default_servings integer NOT NULL DEFAULT 4,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_items_select_all ON public.menu_items;
CREATE POLICY menu_items_select_all ON public.menu_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS menu_items_modify_owner ON public.menu_items;
CREATE POLICY menu_items_modify_owner ON public.menu_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.menus m WHERE m.id = menu_id AND (m.owner_id = auth.uid() OR has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.menus m WHERE m.id = menu_id AND (m.owner_id = auth.uid() OR has_role(auth.uid(),'admin'))));

-- 5) Menu scalings (per user)
CREATE TABLE IF NOT EXISTS public.menu_scalings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  name text NOT NULL,
  servings_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_scalings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_scalings_own ON public.menu_scalings;
CREATE POLICY menu_scalings_own ON public.menu_scalings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6) Realtime for menus optional
ALTER PUBLICATION supabase_realtime ADD TABLE public.menus;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;

-- 7) Attach superadmin protection trigger if not present
DROP TRIGGER IF EXISTS protect_superadmin_trg ON public.user_roles;
CREATE TRIGGER protect_superadmin_trg BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_superadmin();
