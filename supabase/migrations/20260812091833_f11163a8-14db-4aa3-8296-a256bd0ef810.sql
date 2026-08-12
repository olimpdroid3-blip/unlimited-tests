ALTER TABLE public.telegram_video_messages
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.telegram_video_messages
  DROP CONSTRAINT IF EXISTS telegram_video_messages_notes_len,
  ADD CONSTRAINT telegram_video_messages_notes_len CHECK (notes IS NULL OR char_length(notes) <= 2000);

CREATE TABLE IF NOT EXISTS public.telegram_video_pending_heroes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id bigint NOT NULL,
  telegram_thread_id bigint,
  telegram_user_id bigint NOT NULL,
  video_message_id bigint NOT NULL,
  video_row_id uuid REFERENCES public.telegram_video_messages(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting_for_heroes'
    CHECK (status IN ('waiting_for_heroes','waiting_for_notes','completed','cancelled')),
  confirmed_hero_ids uuid[] NOT NULL DEFAULT '{}',
  unresolved_token text,
  suggestion_hero_ids uuid[] NOT NULL DEFAULT '{}',
  prompt_message_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes'
);

CREATE UNIQUE INDEX IF NOT EXISTS telegram_video_pending_unique
  ON public.telegram_video_pending_heroes (telegram_chat_id, telegram_user_id, video_message_id);

CREATE INDEX IF NOT EXISTS telegram_video_pending_active_idx
  ON public.telegram_video_pending_heroes (telegram_chat_id, telegram_user_id, status, created_at DESC);

GRANT SELECT ON public.telegram_video_pending_heroes TO authenticated;
GRANT ALL ON public.telegram_video_pending_heroes TO service_role;
ALTER TABLE public.telegram_video_pending_heroes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pending_read" ON public.telegram_video_pending_heroes
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_pending_touch
  BEFORE UPDATE ON public.telegram_video_pending_heroes
  FOR EACH ROW EXECUTE FUNCTION public.tower_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.video_heroes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_message_id uuid NOT NULL REFERENCES public.telegram_video_messages(id) ON DELETE CASCADE,
  hero_id uuid NOT NULL REFERENCES public.heroes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_heroes_unique UNIQUE (video_message_id, hero_id)
);

CREATE INDEX IF NOT EXISTS video_heroes_hero_idx ON public.video_heroes (hero_id);

GRANT SELECT ON public.video_heroes TO anon;
GRANT SELECT ON public.video_heroes TO authenticated;
GRANT ALL ON public.video_heroes TO service_role;
ALTER TABLE public.video_heroes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_heroes_read" ON public.video_heroes
  FOR SELECT TO anon, authenticated USING (true);