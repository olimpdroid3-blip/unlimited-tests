ALTER TABLE public.battle_power
  ADD COLUMN squad smallint CONSTRAINT battle_power_squad_check CHECK (squad IN (1, 2));
