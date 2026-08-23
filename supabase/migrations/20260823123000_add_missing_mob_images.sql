UPDATE public.mobs
SET
  image_url = '/mobs/image43.png',
  updated_at = now()
WHERE id = 'mob-12';

INSERT INTO public.mobs (id, name, image_url, mob_type, rarity)
VALUES
  ('mob-45', 'Моб 45', '/mobs/image44.png', 'demon', 'epic'),
  ('mob-46', 'Моб 46', '/mobs/image45.png', 'demon', 'epic'),
  ('mob-47', 'Моб 47', '/mobs/image46.png', 'demon', 'epic')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url,
  mob_type = EXCLUDED.mob_type,
  rarity = EXCLUDED.rarity,
  updated_at = now();
