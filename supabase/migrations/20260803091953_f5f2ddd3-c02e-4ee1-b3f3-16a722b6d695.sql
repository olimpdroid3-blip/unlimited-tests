CREATE TABLE public.battle_power (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname text NOT NULL,
  power1 numeric,
  power2 numeric,
  power3 numeric,
  power4 numeric,
  power5 numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_power TO anon, authenticated;
GRANT ALL ON public.battle_power TO service_role;
ALTER TABLE public.battle_power ENABLE ROW LEVEL SECURITY;
CREATE POLICY battle_power_all_anon ON public.battle_power FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER battle_power_touch_updated_at BEFORE UPDATE ON public.battle_power FOR EACH ROW EXECUTE FUNCTION public.tower_touch_updated_at();