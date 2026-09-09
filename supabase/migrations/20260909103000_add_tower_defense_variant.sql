-- Independent of tower entries: an empty tower can be marked without being filled.
CREATE TABLE public.tower_defense_variants (
  tower_id text PRIMARY KEY CHECK (tower_id ~ '^[1-4]\.[1-6]\.[1-2]$'),
  variant smallint NOT NULL CHECK (variant BETWEEN 1 AND 25)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tower_defense_variants TO anon, authenticated;
GRANT ALL ON public.tower_defense_variants TO service_role;
ALTER TABLE public.tower_defense_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tower_defense_variants_all_anon
  ON public.tower_defense_variants FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE public.towers_archive
  ADD COLUMN defense_variant smallint
  CHECK (defense_variant BETWEEN 1 AND 25);
