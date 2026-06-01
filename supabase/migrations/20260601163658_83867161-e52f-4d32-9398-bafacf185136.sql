
-- 1) Hide drafts from non-authors
DROP POLICY IF EXISTS recipes_select_visible ON public.recipes;
CREATE POLICY recipes_select_visible ON public.recipes
  FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.role_tier(auth.uid()) >= COALESCE(deleted_by_tier, 99))
    AND (
      is_draft = false
      OR author_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 2) Storage: replace broad SELECT with owner-scoped; add UPDATE policies
DROP POLICY IF EXISTS public_read_recipe_images ON storage.objects;
DROP POLICY IF EXISTS public_read_comment_images ON storage.objects;
DROP POLICY IF EXISTS public_read_chat_images ON storage.objects;

CREATE POLICY owner_list_recipe_images ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-images' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY owner_list_comment_images ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'comment-images' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY owner_list_chat_images ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY auth_update_own_recipe_images ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'recipe-images' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'recipe-images' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY auth_update_own_comment_images ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'comment-images' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'comment-images' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY auth_update_own_chat_images ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-images' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'chat-images' AND (auth.uid())::text = (storage.foldername(name))[1]);
