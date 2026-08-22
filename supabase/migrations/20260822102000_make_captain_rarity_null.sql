ALTER TABLE public.mobs
  ALTER COLUMN rarity DROP NOT NULL;

UPDATE public.mobs
SET rarity = NULL
WHERE mob_type = 'demon-captain';

ALTER TABLE public.mobs
  DROP CONSTRAINT IF EXISTS mobs_classification_check,
  ADD CONSTRAINT mobs_classification_check CHECK (
    (mob_type = 'demon' AND rarity IN ('epic', 'legendary'))
    OR (mob_type = 'demon-captain' AND rarity IS NULL)
  );

COMMENT ON COLUMN public.mobs.rarity IS
  'Mob rarity: epic or legendary for demons; null for demon captains';
