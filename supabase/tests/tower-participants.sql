-- Run against a disposable database after the migrations, never production.
BEGIN;
SET LOCAL ROLE anon;
INSERT INTO towers(tower_id, nickname, notes, placed, testing) VALUES
  ('1.1.1', 'Alice', 'First', true, false), ('2.1.1', 'Bob', 'Second', true, true);
INSERT INTO tower_defense_variants(tower_id, variant) VALUES ('1.1.1',2), ('2.1.1',2), ('4.1.1',2);
SELECT save_tower_with_participants('1.1.1', '{"nickname":"Alice","notes":"First","placed":true}',
  '[{"nickname":"Alice","comment":"First"},{"nickname":"Bob","comment":"Second"}]', ARRAY['1.1.1','2.1.1','4.1.1']);
DO $$ BEGIN
  IF (SELECT count(*) FROM towers WHERE jsonb_array_length(participants) = 2) <> 3 THEN RAISE EXCEPTION 'Group not synced'; END IF;
  IF NOT (SELECT testing AND placed FROM towers WHERE tower_id='2.1.1') THEN RAISE EXCEPTION 'Sibling status changed'; END IF;
  IF (SELECT placed FROM towers WHERE tower_id='4.1.1') THEN RAISE EXCEPTION 'Empty sibling marked placed'; END IF;
END $$;
SELECT save_tower_with_participants('1.1.1', '{"nickname":null,"placed":true}', '[]', ARRAY['1.1.1','2.1.1','4.1.1']);
DO $$ BEGIN
  IF EXISTS (SELECT FROM towers WHERE participants <> '[]'::jsonb) THEN RAISE EXCEPTION 'Deleted names restored'; END IF;
END $$;
-- A legacy/Telegram submission remains visible after the new editor has been used.
UPDATE towers SET nickname='Carol', notes='Third' WHERE tower_id='2.1.1';
DO $$ BEGIN
  IF (SELECT participants FROM towers WHERE tower_id='2.1.1') <> '[{"nickname":"Carol","comment":"Third"}]'::jsonb THEN RAISE EXCEPTION 'Legacy submission hidden'; END IF;
END $$;
-- Wrong group must fail atomically.
DO $$ BEGIN
  BEGIN
    PERFORM save_tower_with_participants('1.1.1', '{"nickname":"Wrong"}', '[]', ARRAY['1.1.1']);
    RAISE EXCEPTION 'Expected group conflict';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected group conflict' THEN RAISE; END IF;
  END;
  IF (SELECT nickname FROM towers WHERE tower_id='1.1.1') IS NOT NULL THEN RAISE EXCEPTION 'Conflict partially saved'; END IF;
END $$;
INSERT INTO towers_archive(tower_id, participants) SELECT tower_id, participants FROM towers;
DO $$ BEGIN
  IF (SELECT participants FROM towers_archive WHERE tower_id='2.1.1') <> '[{"nickname":"Carol","comment":"Third"}]'::jsonb THEN RAISE EXCEPTION 'Archive lost comments'; END IF;
END $$;
ROLLBACK;
