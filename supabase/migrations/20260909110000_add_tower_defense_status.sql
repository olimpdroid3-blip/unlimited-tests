ALTER TABLE public.towers
  ADD COLUMN placed boolean NOT NULL DEFAULT false,
  ADD COLUMN testing boolean NOT NULL DEFAULT false,
  ADD COLUMN destroyed boolean NOT NULL DEFAULT false,
  ADD COLUMN removed boolean NOT NULL DEFAULT false,
  ADD COLUMN previous_nickname text;

-- Existing tower entries were already considered placed; mirror requests are separate markers.
UPDATE public.towers SET placed = true WHERE tower_id ~ '^[1-4]\.[1-6]\.[1-2]$';

ALTER TABLE public.towers_archive
  ADD COLUMN placed boolean NOT NULL DEFAULT false,
  ADD COLUMN testing boolean NOT NULL DEFAULT false,
  ADD COLUMN destroyed boolean NOT NULL DEFAULT false,
  ADD COLUMN removed boolean NOT NULL DEFAULT false,
  ADD COLUMN previous_nickname text;

UPDATE public.towers_archive SET placed = true;

CREATE FUNCTION public.sync_tower_defense_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- A fully destroyed defense is also breached. Unchecking breached clears destroyed.
  IF TG_OP = 'UPDATE' THEN
    IF NOT NEW.breached AND OLD.breached AND NEW.destroyed = OLD.destroyed THEN
      NEW.destroyed := false;
    END IF;
  END IF;
  IF NEW.destroyed THEN
    NEW.breached := true;
  END IF;

  IF NEW.removed THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.previous_nickname := COALESCE(NULLIF(trim(OLD.nickname), ''), OLD.previous_nickname, NEW.previous_nickname);
    END IF;
    NEW.nickname := NULL;
    NEW.placed := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_tower_defense_status
  BEFORE INSERT OR UPDATE ON public.towers
  FOR EACH ROW EXECUTE FUNCTION public.sync_tower_defense_status();
