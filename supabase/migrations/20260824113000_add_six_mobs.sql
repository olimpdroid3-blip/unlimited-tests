INSERT INTO public.mobs (id, name, image_url, mob_type, rarity)
VALUES
  ('mob-48', 'Моб 48', '/mobs/image47.jpg', 'demon', 'epic'),
  ('mob-49', 'Моб 49', '/mobs/image48.jpg', 'demon', 'epic'),
  ('mob-50', 'Моб 50', '/mobs/image49.jpg', 'demon', 'epic'),
  ('mob-51', 'Моб 51', '/mobs/image50.jpg', 'demon', 'epic'),
  ('mob-52', 'Моб 52', '/mobs/image51.jpg', 'demon', 'epic'),
  ('mob-53', 'Моб 53', '/mobs/image52.jpg', 'demon', 'epic')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url,
  mob_type = EXCLUDED.mob_type,
  rarity = EXCLUDED.rarity,
  updated_at = now();
