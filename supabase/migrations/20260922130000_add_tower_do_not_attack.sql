ALTER TABLE public.towers
  ADD COLUMN do_not_attack boolean NOT NULL DEFAULT false;
ALTER TABLE public.towers_archive
  ADD COLUMN do_not_attack boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.save_tower_with_participants(
  p_tower_id text, p_details jsonb, p_participants jsonb, p_group_ids text[]
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  group_ids text[];
  copy_number smallint;
BEGIN
  IF p_tower_id !~ '^[1-4]\.[1-6]\.[1-2]$' THEN
    RAISE EXCEPTION 'Invalid tower';
  END IF;
  IF p_participants IS NULL OR jsonb_typeof(p_participants) <> 'array' THEN
    RAISE EXCEPTION 'Invalid participants';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_participants) entry
    WHERE jsonb_typeof(entry->'nickname') IS DISTINCT FROM 'string'
      OR nullif(btrim(entry->>'nickname'), '') IS NULL
      OR jsonb_typeof(entry->'comment') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'Invalid participant';
  END IF;
  -- Prevent a copy selection changing halfway through a save.
  LOCK TABLE public.tower_defense_variants IN SHARE MODE;
  SELECT variant INTO copy_number FROM public.tower_defense_variants WHERE tower_id = p_tower_id;
  IF copy_number IS NULL THEN
    group_ids := ARRAY[p_tower_id];
  ELSE
    SELECT array_agg(tower_id ORDER BY tower_id) INTO group_ids
      FROM public.tower_defense_variants WHERE variant = copy_number;
  END IF;
  IF group_ids IS DISTINCT FROM (SELECT array_agg(id ORDER BY id) FROM unnest(p_group_ids) id) THEN
    RAISE EXCEPTION 'Copy group changed. Refresh and try again.';
  END IF;

  INSERT INTO public.towers (tower_id, nickname, awakenings, notes, placed, breached,
    testing, destroyed, removed, do_not_attack, previous_nickname, screenshot_url, screenshot_path, participants, updated_at)
  VALUES (p_tower_id, p_details->>'nickname', p_details->>'awakenings', p_details->>'notes',
    coalesce((p_details->>'placed')::boolean, false), coalesce((p_details->>'breached')::boolean, false),
    coalesce((p_details->>'testing')::boolean, false), coalesce((p_details->>'destroyed')::boolean, false),
    coalesce((p_details->>'removed')::boolean, false), coalesce((p_details->>'do_not_attack')::boolean, false),
    p_details->>'previous_nickname',
    p_details->>'screenshot_url', p_details->>'screenshot_path', p_participants, now())
  ON CONFLICT (tower_id) DO UPDATE SET
    nickname = EXCLUDED.nickname, awakenings = EXCLUDED.awakenings, notes = EXCLUDED.notes,
    placed = EXCLUDED.placed, breached = EXCLUDED.breached, testing = EXCLUDED.testing,
    destroyed = EXCLUDED.destroyed, removed = EXCLUDED.removed, do_not_attack = EXCLUDED.do_not_attack, previous_nickname = EXCLUDED.previous_nickname,
    screenshot_url = EXCLUDED.screenshot_url, screenshot_path = EXCLUDED.screenshot_path,
    participants = EXCLUDED.participants, updated_at = now();

  INSERT INTO public.towers (tower_id, participants, placed)
    SELECT id, p_participants, false FROM unnest(group_ids) id WHERE id <> p_tower_id
  ON CONFLICT (tower_id) DO UPDATE SET participants = EXCLUDED.participants, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_tower_with_participants(text, jsonb, jsonb, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_tower_with_participants(text, jsonb, jsonb, text[]) TO anon, authenticated, service_role;

