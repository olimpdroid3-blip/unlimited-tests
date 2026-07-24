
-- heroes
CREATE TABLE public.heroes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  icon_url text,
  source_icon_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heroes TO anon, authenticated;
GRANT ALL ON public.heroes TO service_role;
ALTER TABLE public.heroes ENABLE ROW LEVEL SECURITY;
CREATE POLICY heroes_all_anon ON public.heroes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_heroes_updated_at BEFORE UPDATE ON public.heroes
  FOR EACH ROW EXECUTE FUNCTION public.tower_touch_updated_at();

-- defenses
CREATE TABLE public.defenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screenshot_url text,
  run_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.defenses TO anon, authenticated;
GRANT ALL ON public.defenses TO service_role;
ALTER TABLE public.defenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY defenses_all_anon ON public.defenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_defenses_updated_at BEFORE UPDATE ON public.defenses
  FOR EACH ROW EXECUTE FUNCTION public.tower_touch_updated_at();

-- defense_heroes
CREATE TABLE public.defense_heroes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  defense_id uuid NOT NULL REFERENCES public.defenses(id) ON DELETE CASCADE,
  hero_id uuid NOT NULL REFERENCES public.heroes(id) ON DELETE RESTRICT,
  position smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.defense_heroes TO anon, authenticated;
GRANT ALL ON public.defense_heroes TO service_role;
ALTER TABLE public.defense_heroes ENABLE ROW LEVEL SECURITY;
CREATE POLICY defense_heroes_all_anon ON public.defense_heroes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_defense_heroes_defense ON public.defense_heroes(defense_id);
CREATE INDEX idx_defense_heroes_hero ON public.defense_heroes(hero_id);
