-- PREPARED, NOT APPLIED.
-- Optional future replacement for the Storage-backed metadata file
-- (defense-screenshots/bot-state/tower-requests.json). Apply only after the
-- owner confirms DDL access to the external Supabase project.

CREATE TABLE IF NOT EXISTS public.tower_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tower_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  screenshot_url TEXT,
  screenshot_path TEXT,
  comment TEXT,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'telegram')),
  telegram_user_id BIGINT,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tower_requests_tower_id_key
  ON public.tower_requests (tower_id);

GRANT SELECT ON public.tower_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tower_requests TO authenticated;
GRANT ALL ON public.tower_requests TO service_role;

ALTER TABLE public.tower_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tower_requests_read" ON public.tower_requests
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tower_requests_write" ON public.tower_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Telegram add-form sessions (currently in bot-state/tower-forms.json)
CREATE TABLE IF NOT EXISTS public.telegram_tower_forms (
  id TEXT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  thread_id INTEGER NOT NULL,
  user_id BIGINT NOT NULL,
  nickname TEXT NOT NULL,
  step TEXT NOT NULL,
  tower_id TEXT,
  screenshot_url TEXT,
  screenshot_path TEXT,
  comment TEXT,
  bot_message_ids BIGINT[] NOT NULL DEFAULT '{}',
  user_message_ids BIGINT[] NOT NULL DEFAULT '{}',
  submitted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

GRANT ALL ON public.telegram_tower_forms TO service_role;
ALTER TABLE public.telegram_tower_forms ENABLE ROW LEVEL SECURITY;
