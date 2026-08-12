ALTER TABLE public.telegram_video_pending_heroes
ADD COLUMN IF NOT EXISTS bot_message_ids bigint[] NOT NULL DEFAULT '{}'::bigint[];