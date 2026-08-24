ALTER TABLE public.battle_power
  ADD COLUMN IF NOT EXISTS power1_crowned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS power2_crowned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS power3_crowned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS power4_crowned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS power5_crowned boolean NOT NULL DEFAULT false;
