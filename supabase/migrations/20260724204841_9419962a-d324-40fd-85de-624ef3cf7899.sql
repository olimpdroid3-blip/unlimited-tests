
CREATE POLICY "hero_icons_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'hero-icons');
CREATE POLICY "hero_icons_write" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'hero-icons');
CREATE POLICY "hero_icons_update" ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'hero-icons') WITH CHECK (bucket_id = 'hero-icons');
CREATE POLICY "hero_icons_delete" ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'hero-icons');

CREATE POLICY "def_shots_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'defense-screenshots');
CREATE POLICY "def_shots_write" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'defense-screenshots');
CREATE POLICY "def_shots_update" ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'defense-screenshots') WITH CHECK (bucket_id = 'defense-screenshots');
CREATE POLICY "def_shots_delete" ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'defense-screenshots');
