create function public.awakening_read(p_scope text, p_position text default null) returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('match_id',m.match_id,'reports',coalesce((
   select jsonb_agg(jsonb_build_object('tower_position',d.tower_position,'player_name',d.player_name,
     'total_bp',d.total_bp,'heroes',d.heroes,'captured_at',d.captured_at,'received_at',d.received_at)
     order by d.tower_position)
   from awakening_private.defenses d where d.scope=m.scope and d.match_id=m.match_id
     and (p_position is null or d.tower_position=p_position)
 ),'[]'::jsonb)) from awakening_private.matches m where m.scope=p_scope;
$$;
create function public.awakening_tower_reset_snapshot() returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('match_id',m.match_id,
   'towers',coalesce((select jsonb_agg(to_jsonb(t) order by t.tower_id) from public.towers t),'[]'::jsonb),
   'variants',coalesce((select jsonb_agg(to_jsonb(v) order by v.tower_id) from public.tower_defense_variants v),'[]'::jsonb))
 from awakening_private.matches m where scope='nonameclan';
$$;
create function public.awakening_clear_towers(p_snapshot jsonb,p_archive_rows jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_match uuid; v_current jsonb; v_new uuid; v_paths jsonb;
begin
 select match_id into v_match from awakening_private.matches where scope='nonameclan' for update;
 if v_match::text is distinct from p_snapshot->>'match_id' then raise exception 'MATCH_CHANGED'; end if;
 lock table public.towers,public.tower_defense_variants in share row exclusive mode;
 v_current:=public.awakening_tower_reset_snapshot();
 if v_current is distinct from p_snapshot then raise exception 'TOWERS_CHANGED'; end if;
 if jsonb_typeof(p_archive_rows) is distinct from 'array' then raise exception 'INVALID_ARCHIVE'; end if;
 -- The trusted server computes group participants with the site's existing helper.
 if (select count(*) from (
    select tower_id from public.towers where tower_id not like 'M:%'
    union select tower_id from public.tower_defense_variants) ids)
    <> jsonb_array_length(p_archive_rows) then raise exception 'INCOMPLETE_ARCHIVE'; end if;
 insert into public.towers_archive(tower_id,nickname,awakenings,notes,breached,defense_variant,
    placed,testing,destroyed,removed,previous_nickname,participants,do_not_attack,screenshot_url)
 select x.tower_id,x.nickname,x.awakenings,x.notes,x.breached,x.defense_variant,
    x.placed,x.testing,x.destroyed,x.removed,x.previous_nickname,x.participants,x.do_not_attack,null
 from jsonb_to_recordset(p_archive_rows) as x(tower_id text,nickname text,awakenings text,notes text,
    breached boolean,defense_variant smallint,placed boolean,testing boolean,destroyed boolean,
    removed boolean,previous_nickname text,participants jsonb,do_not_attack boolean);
 select coalesce(jsonb_agg(screenshot_path) filter(where screenshot_path is not null),'[]'::jsonb)
   into v_paths from public.towers;
 delete from public.tower_defense_variants;
 delete from public.towers;
 v_new:=public.awakening_reset_match('nonameclan',v_match);
 return jsonb_build_object('ok',true,'match_id',v_new,'screenshot_paths',v_paths);
end $$;
revoke all on function public.awakening_read(text,text),public.awakening_tower_reset_snapshot(),public.awakening_clear_towers(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.awakening_read(text,text),public.awakening_tower_reset_snapshot(),public.awakening_clear_towers(jsonb,jsonb) to service_role;
