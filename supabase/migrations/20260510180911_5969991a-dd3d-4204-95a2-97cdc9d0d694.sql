
-- 1. recipes: time_required + tags
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS time_required text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- backfill existing rows so NOT NULL works
UPDATE public.recipes SET time_required = '30 min' WHERE time_required IS NULL;
ALTER TABLE public.recipes ALTER COLUMN time_required SET NOT NULL;
ALTER TABLE public.recipes ALTER COLUMN time_required SET DEFAULT '30 min';

CREATE INDEX IF NOT EXISTS idx_recipes_tags ON public.recipes USING GIN(tags);

-- 2. chat_messages: image, optional recipient (broadcast), updated_at
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.chat_messages ALTER COLUMN recipient_id DROP NOT NULL;

-- update select policy to also see broadcasts
DROP POLICY IF EXISTS chat_select_own ON public.chat_messages;
CREATE POLICY chat_select_own ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
    OR recipient_id IS NULL
  );

-- only admin may broadcast (recipient_id IS NULL)
DROP POLICY IF EXISTS chat_insert_as_sender ON public.chat_messages;
CREATE POLICY chat_insert_as_sender ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (recipient_id IS NOT NULL OR public.has_role(auth.uid(), 'admin'))
  );

-- 3. categories: allow users to create root categories too
DROP POLICY IF EXISTS categories_insert_authenticated ON public.categories;
CREATE POLICY categories_insert_authenticated ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- 4. comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_recipe ON public.comments(recipe_id);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_select_all ON public.comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY comments_insert_own ON public.comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY comments_update_own_or_admin ON public.comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY comments_delete_own_or_admin ON public.comments
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. SECURITY DEFINER tag helpers (any authenticated user may modify tags on any recipe)
CREATE OR REPLACE FUNCTION public.add_recipe_tag(_recipe_id uuid, _tag text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE clean text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  clean := lower(trim(_tag));
  IF clean = '' OR length(clean) > 40 THEN RETURN; END IF;
  UPDATE public.recipes
    SET tags = (SELECT array_agg(DISTINCT t) FROM unnest(array_append(tags, clean)) t)
    WHERE id = _recipe_id;
END; $$;

CREATE OR REPLACE FUNCTION public.remove_recipe_tag(_recipe_id uuid, _tag text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.recipes
    SET tags = array_remove(tags, lower(trim(_tag)))
    WHERE id = _recipe_id;
END; $$;

-- 6. Superadmin protection
CREATE OR REPLACE FUNCTION public.is_superadmin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND lower(email) = 'imperium1886@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.protect_superadmin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'admin' AND public.is_superadmin_user(OLD.user_id) THEN
    -- attacker loses admin rights
    DELETE FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
        AND NOT public.is_superadmin_user(auth.uid());
    RAISE EXCEPTION 'Superadmin-Schutz: Diese Rolle kann nicht entfernt werden';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_superadmin ON public.user_roles;
CREATE TRIGGER trg_protect_superadmin
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_superadmin();

-- ensure superadmin gets admin on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  IF lower(NEW.email) = 'imperium1886@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- if superadmin already exists, ensure admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) = 'imperium1886@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Insert "Getränke" main category if missing
INSERT INTO public.categories (name, is_root, parent_id)
SELECT 'Getränke', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE is_root = true AND name = 'Getränke');

-- 8. Storage buckets (public-read)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('recipe-images', 'recipe-images', true),
  ('comment-images', 'comment-images', true),
  ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for these buckets
CREATE POLICY "public_read_recipe_images" ON storage.objects FOR SELECT
  USING (bucket_id = 'recipe-images');
CREATE POLICY "public_read_comment_images" ON storage.objects FOR SELECT
  USING (bucket_id = 'comment-images');
CREATE POLICY "public_read_chat_images" ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-images');

-- Authenticated users can upload into their own folder (path starts with their uid)
CREATE POLICY "auth_upload_recipe_images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth_upload_comment_images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comment-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth_upload_chat_images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "auth_delete_own_recipe_images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recipe-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth_delete_own_comment_images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comment-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth_delete_own_chat_images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
