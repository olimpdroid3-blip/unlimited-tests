-- NULL preserves legacy/Telegram rows; [] explicitly means all names were removed.
ALTER TABLE public.towers ADD COLUMN participants jsonb
  CHECK (participants IS NULL OR jsonb_typeof(participants) = 'array');
ALTER TABLE public.towers_archive ADD COLUMN participants jsonb
  CHECK (participants IS NULL OR jsonb_typeof(participants) = 'array');

-- Save the current cell and the shared owner list in one transaction.
-- Other cells keep their own placement, status, screenshot and awakenings.
CREATE FUNCTION public.save_tower_with_participants(
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
    testing, destroyed, removed, previous_nickname, screenshot_url, screenshot_path, participants, updated_at)
  VALUES (p_tower_id, p_details->>'nickname', p_details->>'awakenings', p_details->>'notes',
    coalesce((p_details->>'placed')::boolean, false), coalesce((p_details->>'breached')::boolean, false),
    coalesce((p_details->>'testing')::boolean, false), coalesce((p_details->>'destroyed')::boolean, false),
    coalesce((p_details->>'removed')::boolean, false), p_details->>'previous_nickname',
    p_details->>'screenshot_url', p_details->>'screenshot_path', p_participants, now())
  ON CONFLICT (tower_id) DO UPDATE SET
    nickname = EXCLUDED.nickname, awakenings = EXCLUDED.awakenings, notes = EXCLUDED.notes,
    placed = EXCLUDED.placed, breached = EXCLUDED.breached, testing = EXCLUDED.testing,
    destroyed = EXCLUDED.destroyed, removed = EXCLUDED.removed, previous_nickname = EXCLUDED.previous_nickname,
    screenshot_url = EXCLUDED.screenshot_url, screenshot_path = EXCLUDED.screenshot_path,
    participants = EXCLUDED.participants, updated_at = now();

  INSERT INTO public.towers (tower_id, participants, placed)
    SELECT id, p_participants, false FROM unnest(group_ids) id WHERE id <> p_tower_id
  ON CONFLICT (tower_id) DO UPDATE SET participants = EXCLUDED.participants, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_tower_with_participants(text, jsonb, jsonb, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_tower_with_participants(text, jsonb, jsonb, text[]) TO anon, authenticated, service_role;

-- Older writers (including Telegram) still submit nickname/notes. Keep those
-- submissions visible after a cell has been edited with the new owner list.
CREATE FUNCTION public.sync_legacy_tower_participant() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  entries jsonb;
BEGIN
  IF nullif(btrim(NEW.nickname), '') IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.participants IS NULL THEN
      NEW.participants := jsonb_build_array(jsonb_build_object('nickname', btrim(NEW.nickname), 'comment', coalesce(NEW.notes, '')));
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.participants IS DISTINCT FROM OLD.participants
    OR (NEW.nickname IS NOT DISTINCT FROM OLD.nickname AND NEW.notes IS NOT DISTINCT FROM OLD.notes) THEN
    RETURN NEW;
  END IF;
  entries := coalesce(OLD.participants,
    CASE WHEN nullif(btrim(OLD.nickname), '') IS NULL THEN '[]'::jsonb
      ELSE jsonb_build_array(jsonb_build_object('nickname', btrim(OLD.nickname), 'comment', coalesce(OLD.notes, ''))) END);
  SELECT coalesce(jsonb_agg(entry), '[]'::jsonb) INTO entries
    FROM jsonb_array_elements(entries) entry WHERE entry->>'nickname' <> btrim(NEW.nickname);
  NEW.participants := entries || jsonb_build_array(jsonb_build_object('nickname', btrim(NEW.nickname), 'comment', coalesce(NEW.notes, '')));
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_zz_sync_legacy_tower_participant BEFORE INSERT OR UPDATE ON public.towers
  FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_tower_participant();
