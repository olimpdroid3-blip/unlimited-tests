ALTER TABLE public.telegram_video_messages
  ADD COLUMN IF NOT EXISTS telegram_uploader_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_uploader_name TEXT,
  ADD COLUMN IF NOT EXISTS telegram_uploader_custom_title TEXT;

CREATE INDEX IF NOT EXISTS idx_tvm_uploader_name ON public.telegram_video_messages (telegram_uploader_name);