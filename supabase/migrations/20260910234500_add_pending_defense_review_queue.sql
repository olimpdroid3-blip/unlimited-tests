create table if not exists public.pending_defenses (
  id uuid primary key default gen_random_uuid(),
  screenshot_url text not null,
  run_code text not null,
  comment text,
  submitted_nickname text,
  telegram_user_id bigint,
  telegram_chat_id bigint not null,
  telegram_thread_id bigint not null default 4,
  source_form_id text not null unique,
  created_at timestamptz not null default now()
);

alter table public.pending_defenses enable row level security;

drop policy if exists pending_defenses_all_anon on public.pending_defenses;
create policy pending_defenses_all_anon
  on public.pending_defenses
  for all
  to anon, authenticated
  using (true)
  with check (true);

create or replace function public.finalize_pending_defense(
  p_pending_id uuid,
  p_screenshot_url text,
  p_run_code text,
  p_player_id uuid,
  p_comment text,
  p_hero_ids uuid[],
  p_mob_ids text[]
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  pending_row public.pending_defenses%rowtype;
  created_defense_id uuid;
begin
  select * into pending_row
  from public.pending_defenses
  where id = p_pending_id
  for update;

  if not found then
    raise exception 'Pending walkthrough not found';
  end if;

  if p_player_id is null then
    raise exception 'Player is required';
  end if;

  if coalesce(cardinality(p_hero_ids), 0) not between 1 and 5
    or array_position(p_hero_ids, null) is not null
    or (
      select count(*) <> count(distinct hero_id)
      from unnest(p_hero_ids) as selected_hero(hero_id)
    )
  then
    raise exception 'Choose 1 to 5 unique heroes';
  end if;

  if coalesce(cardinality(p_mob_ids), 0) not between 2 and 5
    or array_position(p_mob_ids, null) is not null
    or (
      select count(*) <> count(distinct mob_id)
      from unnest(p_mob_ids) as selected_mob(mob_id)
    )
  then
    raise exception 'Choose 2 to 5 unique mobs';
  end if;

  insert into public.defenses (screenshot_url, run_code, player_id, comment)
  values (
    coalesce(nullif(btrim(p_screenshot_url), ''), pending_row.screenshot_url),
    coalesce(nullif(btrim(p_run_code), ''), pending_row.run_code),
    p_player_id,
    nullif(btrim(p_comment), '')
  )
  returning id into created_defense_id;

  insert into public.defense_heroes (defense_id, hero_id, position)
  select created_defense_id, hero_id, ordinality::smallint
  from unnest(p_hero_ids) with ordinality as selected_hero(hero_id, ordinality);

  insert into public.defense_mobs (defense_id, mob_id, position)
  select created_defense_id, mob_id, ordinality::smallint
  from unnest(p_mob_ids) with ordinality as selected_mob(mob_id, ordinality);

  delete from public.pending_defenses where id = p_pending_id;

  return created_defense_id;
end;
$$;

grant execute on function public.finalize_pending_defense(uuid, text, text, uuid, text, uuid[], text[]) to anon, authenticated, service_role;
