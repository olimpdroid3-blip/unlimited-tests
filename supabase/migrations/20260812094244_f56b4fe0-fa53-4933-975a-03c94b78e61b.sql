GRANT UPDATE, DELETE ON public.telegram_video_messages TO anon, authenticated;
GRANT DELETE ON public.video_heroes TO anon, authenticated;

CREATE POLICY "telegram_video_messages_update" ON public.telegram_video_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "telegram_video_messages_delete" ON public.telegram_video_messages FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "video_heroes_delete" ON public.video_heroes FOR DELETE TO anon, authenticated USING (true);