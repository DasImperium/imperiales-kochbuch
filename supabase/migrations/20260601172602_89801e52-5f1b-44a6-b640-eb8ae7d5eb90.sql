-- 1) Inventory: Sicherheits- und Mindestbestand
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS safety_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock numeric NOT NULL DEFAULT 0;

-- 2) list_snapshots: maximal 2 pro (owner, kind) — Trigger schneidet ältere ab
CREATE OR REPLACE FUNCTION public.trim_list_snapshots()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.list_snapshots
   WHERE owner_id = NEW.owner_id AND list_kind = NEW.list_kind
     AND id NOT IN (
       SELECT id FROM public.list_snapshots
        WHERE owner_id = NEW.owner_id AND list_kind = NEW.list_kind
        ORDER BY created_at DESC LIMIT 2
     );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_trim_list_snapshots ON public.list_snapshots;
CREATE TRIGGER trg_trim_list_snapshots
AFTER INSERT ON public.list_snapshots
FOR EACH ROW EXECUTE FUNCTION public.trim_list_snapshots();

-- Bestehende Snapshots ebenfalls auf 2 limitieren
DELETE FROM public.list_snapshots ls
 WHERE id NOT IN (
   SELECT id FROM (
     SELECT id, row_number() OVER (PARTITION BY owner_id, list_kind ORDER BY created_at DESC) rn
     FROM public.list_snapshots
   ) x WHERE rn <= 2
 );

-- 3) Chat-Nachrichten: DELETE-Policy für Superadmin/Imperator
DROP POLICY IF EXISTS chat_delete_admin ON public.chat_messages;
CREATE POLICY chat_delete_admin ON public.chat_messages
FOR DELETE TO authenticated
USING (
  auth.uid() = sender_id
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
  OR public.has_role(auth.uid(), 'imperator'::app_role)
);

-- 4) deletion_requests: Status-Felder
ALTER TABLE public.deletion_requests
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolver_id uuid,
  ADD COLUMN IF NOT EXISTS resolver_note text;

-- 5) Kategorie "Desserts" entfernen (Dessert bleibt)
DELETE FROM public.categories
 WHERE is_root = true
   AND lower(name) = 'desserts'
   AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.category_id = categories.id);
