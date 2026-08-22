ALTER TABLE public.mobs
  ADD COLUMN mob_type text NOT NULL DEFAULT 'demon'
    CHECK (mob_type IN ('demon', 'demon-captain')),
  ADD COLUMN rarity text NOT NULL DEFAULT 'epic'
    CHECK (rarity IN ('epic', 'legendary'));

COMMENT ON COLUMN public.mobs.mob_type IS 'Mob type: demon or demon-captain';
COMMENT ON COLUMN public.mobs.rarity IS 'Mob rarity: epic or legendary';
