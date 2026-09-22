-- Run only against a disposable database after migrations.
BEGIN;
SET LOCAL ROLE anon;
INSERT INTO towers (tower_id, do_not_attack, destroyed, breached)
VALUES ('1.1.1', true, true, true);
DO $$ BEGIN
  IF NOT (SELECT do_not_attack AND destroyed AND NOT breached FROM towers WHERE tower_id = '1.1.1') THEN
    RAISE EXCEPTION 'Flags were not normalized';
  END IF;
END $$;
SELECT save_tower_with_participants('1.1.1',
  '{"nickname":"Owner","placed":true,"destroyed":true,"do_not_attack":true}',
  '[{"nickname":"Owner","comment":""}]', ARRAY['1.1.1']);
DO $$ BEGIN
  IF NOT (SELECT do_not_attack AND destroyed AND NOT breached FROM towers WHERE tower_id = '1.1.1') THEN
    RAISE EXCEPTION 'Save lost flags';
  END IF;
END $$;
INSERT INTO towers_archive (tower_id, do_not_attack)
SELECT tower_id, do_not_attack FROM towers WHERE tower_id = '1.1.1';
DO $$ BEGIN
  IF NOT (SELECT do_not_attack FROM towers_archive WHERE tower_id = '1.1.1') THEN
    RAISE EXCEPTION 'Archive lost do not attack';
  END IF;
END $$;
UPDATE towers SET do_not_attack = false WHERE tower_id = '1.1.1';
DO $$ BEGIN
  IF NOT (SELECT NOT do_not_attack AND destroyed FROM towers WHERE tower_id = '1.1.1') THEN
    RAISE EXCEPTION 'Clearing do not attack changed destroyed';
  END IF;
END $$;
ROLLBACK;
