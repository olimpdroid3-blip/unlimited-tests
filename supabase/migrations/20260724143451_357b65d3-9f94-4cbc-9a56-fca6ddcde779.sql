
CREATE TABLE public.towers (
  tower_id TEXT PRIMARY KEY,
  nickname TEXT,
  awakenings TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.towers TO anon, authenticated;
GRANT ALL ON public.towers TO service_role;
ALTER TABLE public.towers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "towers_all_anon" ON public.towers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.towers_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tower_id TEXT NOT NULL,
  nickname TEXT,
  awakenings TEXT,
  notes TEXT,
  original_updated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.towers_archive TO anon, authenticated;
GRANT ALL ON public.towers_archive TO service_role;
ALTER TABLE public.towers_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "archive_read" ON public.towers_archive FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "archive_insert" ON public.towers_archive FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tower_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_tower_touch BEFORE UPDATE ON public.towers
FOR EACH ROW EXECUTE FUNCTION public.tower_touch_updated_at();
