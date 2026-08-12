CREATE TABLE public.telegram_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_chat_id bigint NOT NULL,
  telegram_thread_id bigint NOT NULL DEFAULT 0,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_sources_chat_thread_unique UNIQUE (telegram_chat_id, telegram_thread_id)
);

CREATE INDEX idx_telegram_sources_lookup ON public.telegram_sources (telegram_chat_id, telegram_thread_id) WHERE active;

GRANT SELECT ON public.telegram_sources TO anon, authenticated;
GRANT ALL ON public.telegram_sources TO service_role;
ALTER TABLE public.telegram_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telegram_sources_read" ON public.telegram_sources FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.telegram_video_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_chat_id bigint NOT NULL,
  telegram_message_id bigint NOT NULL,
  telegram_thread_id bigint,
  telegram_user_id bigint,
  telegram_username text,
  message_date timestamptz,
  message_type text NOT NULL DEFAULT 'other',
  caption text,
  telegram_message_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_video_messages_unique UNIQUE (telegram_chat_id, telegram_message_id)
);

CREATE INDEX idx_tvm_source ON public.telegram_video_messages (telegram_chat_id, telegram_thread_id);

GRANT SELECT ON public.telegram_video_messages TO anon, authenticated;
GRANT ALL ON public.telegram_video_messages TO service_role;
ALTER TABLE public.telegram_video_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telegram_video_messages_read" ON public.telegram_video_messages FOR SELECT TO anon, authenticated USING (true);