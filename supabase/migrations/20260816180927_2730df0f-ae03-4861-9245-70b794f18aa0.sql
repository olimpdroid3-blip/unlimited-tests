ALTER TABLE public.towers ADD COLUMN IF NOT EXISTS breached boolean NOT NULL DEFAULT false;
ALTER TABLE public.towers_archive ADD COLUMN IF NOT EXISTS breached boolean NOT NULL DEFAULT false;