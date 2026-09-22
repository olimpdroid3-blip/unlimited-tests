CREATE OR REPLACE FUNCTION public.sync_tower_defense_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Explicitly selecting breached replaces destroyed; otherwise destroyed wins.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.breached AND NOT OLD.breached AND NEW.destroyed = OLD.destroyed THEN
      NEW.destroyed := false;
    END IF;
  END IF;
  IF NEW.destroyed THEN
    NEW.breached := false;
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

UPDATE public.towers SET breached = false WHERE destroyed AND breached;
UPDATE public.towers_archive SET breached = false WHERE destroyed AND breached;
