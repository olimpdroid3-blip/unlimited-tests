ALTER TABLE public.defenses
  ADD COLUMN player_id uuid REFERENCES public.battle_power(id) ON DELETE SET NULL,
  ADD COLUMN comment text;

CREATE INDEX defenses_player_id_idx ON public.defenses (player_id);

CREATE TABLE public.defense_mobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  defense_id uuid NOT NULL REFERENCES public.defenses(id) ON DELETE CASCADE,
  mob_id text NOT NULL REFERENCES public.mobs(id) ON DELETE RESTRICT,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (defense_id, mob_id),
  UNIQUE (defense_id, position)
);

CREATE INDEX defense_mobs_mob_id_idx ON public.defense_mobs (mob_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.defense_mobs TO anon, authenticated;
GRANT ALL ON public.defense_mobs TO service_role;

ALTER TABLE public.defense_mobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY defense_mobs_all_anon
  ON public.defense_mobs
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.create_defense_with_details(
  p_screenshot_url text,
  p_run_code text,
  p_player_id uuid,
  p_comment text,
  p_hero_ids uuid[],
  p_mob_ids text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_defense_id uuid;
BEGIN
  IF p_player_id IS NULL THEN
    RAISE EXCEPTION 'Player is required';
  END IF;

  IF COALESCE(cardinality(p_hero_ids), 0) NOT BETWEEN 1 AND 5
    OR array_position(p_hero_ids, NULL) IS NOT NULL
    OR (
      SELECT count(*) <> count(DISTINCT hero_id)
      FROM unnest(p_hero_ids) AS selected_hero(hero_id)
    )
  THEN
    RAISE EXCEPTION 'Choose 1 to 5 unique heroes';
  END IF;

  IF COALESCE(cardinality(p_mob_ids), 0) NOT BETWEEN 2 AND 5
    OR array_position(p_mob_ids, NULL) IS NOT NULL
    OR (
      SELECT count(*) <> count(DISTINCT mob_id)
      FROM unnest(p_mob_ids) AS selected_mob(mob_id)
    )
  THEN
    RAISE EXCEPTION 'Choose 2 to 5 unique mobs';
  END IF;

  INSERT INTO public.defenses (screenshot_url, run_code, player_id, comment)
  VALUES (p_screenshot_url, p_run_code, p_player_id, p_comment)
  RETURNING id INTO created_defense_id;

  INSERT INTO public.defense_heroes (defense_id, hero_id, position)
  SELECT created_defense_id, hero_id, ordinality::smallint
  FROM unnest(p_hero_ids) WITH ORDINALITY AS selected_hero(hero_id, ordinality);

  INSERT INTO public.defense_mobs (defense_id, mob_id, position)
  SELECT created_defense_id, mob_id, ordinality::smallint
  FROM unnest(p_mob_ids) WITH ORDINALITY AS selected_mob(mob_id, ordinality);

  RETURN created_defense_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_defense_with_details(text, text, uuid, text, uuid[], text[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_defense_with_details(text, text, uuid, text, uuid[], text[])
  TO anon, authenticated;

REVOKE INSERT, UPDATE ON public.defenses FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.defense_heroes FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.defense_mobs FROM anon, authenticated;
