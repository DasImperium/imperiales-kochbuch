DROP POLICY IF EXISTS "Group members can update inventory items" ON "public"."inventory_items";
CREATE POLICY "Group members can update inventory items" ON "public"."inventory_items"
FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid() OR 
  owner_id IN (
    SELECT id FROM public.profiles WHERE group_id = (
      SELECT group_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Group members can delete inventory items" ON "public"."inventory_items";
CREATE POLICY "Group members can delete inventory items" ON "public"."inventory_items"
FOR DELETE TO authenticated
USING (
  owner_id = auth.uid() OR 
  owner_id IN (
    SELECT id FROM public.profiles WHERE group_id = (
      SELECT group_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);