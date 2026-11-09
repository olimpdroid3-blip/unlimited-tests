begin;
create temporary table reset_verification_result(result jsonb) on commit drop;
grant select,insert on reset_verification_result to service_role;
set local role service_role;
do $test$
declare s jsonb; a jsonb; result jsonb; old_match uuid; archives_before bigint; towers_before bigint; scouting_before bigint; archive_added bigint;
begin
 s:=public.awakening_tower_reset_snapshot(); old_match:=(s->>'match_id')::uuid;
 select count(*) into archives_before from public.towers_archive;
 select count(*) into towers_before from public.towers;
 select count(*) into scouting_before from awakening_private.defenses where scope='nonameclan' and match_id=old_match;
 select coalesce(jsonb_agg(jsonb_build_object('tower_id',t->>'tower_id','nickname',t->'nickname','awakenings',t->'awakenings','notes',t->'notes','participants',t->'participants','previous_nickname',t->'previous_nickname','defense_variant',null,'placed',t->'placed','testing',t->'testing','breached',t->'breached','destroyed',t->'destroyed','removed',t->'removed','do_not_attack',t->'do_not_attack','screenshot_url',null)),'[]'::jsonb) into a from jsonb_array_elements(s->'towers') t where t->>'tower_id' not like 'M:%';
 begin
  result:=public.awakening_clear_towers(s,a);
  if exists(select 1 from public.towers) or exists(select 1 from public.tower_defense_variants) then raise exception 'Tower rows retained'; end if;
  if jsonb_array_length(public.awakening_read('nonameclan',null)->'reports')<>0 then raise exception 'Scouting retained in active view'; end if;
  if (result->>'match_id')::uuid=old_match then raise exception 'Match unchanged'; end if;
  select count(*)-archives_before into archive_added from public.towers_archive;
  if archive_added<>towers_before then raise exception 'Incomplete tower archive'; end if;
  if (select count(*) from awakening_private.defenses where scope='nonameclan' and match_id=old_match)<>scouting_before then raise exception 'Scouting archive lost'; end if;
  begin
   perform public.awakening_clear_towers(s,a);
   raise exception 'Stale reset accepted';
  exception when raise_exception then
   if sqlerrm<>'MATCH_CHANGED' then raise; end if;
  end;
  s:=public.awakening_tower_reset_snapshot();
  result:=public.awakening_clear_towers(s,'[]'::jsonb);
  if result->>'ok'<>'true' then raise exception 'Empty reset failed'; end if;
  raise exception using errcode='ZX001',message='ALL_RESET_CHECKS_PASSED';
 exception when sqlstate 'ZX001' then
  insert into pg_temp.reset_verification_result values(jsonb_build_object('ok',true,'tower_rows_checked',towers_before,'scouting_positions_checked',scouting_before,'archive_verified',true,'stale_snapshot_rejected',true,'empty_reset_verified',true,'all_changes_rolled_back',true));
 end;
end $test$;
reset role;
select result from reset_verification_result;
rollback;
