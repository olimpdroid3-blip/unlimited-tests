create schema if not exists awakening_private;
revoke all on schema awakening_private from public, anon, authenticated;
grant usage on schema awakening_private to service_role;

create table awakening_private.matches (
  scope text primary key,
  match_id uuid not null default gen_random_uuid(),
  started_at timestamptz not null default now()
);
create table awakening_private.tokens (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  scope text not null references awakening_private.matches(scope),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table awakening_private.imports (
  scope text not null references awakening_private.matches(scope),
  report_id uuid not null,
  match_id uuid not null,
  scouting_id uuid not null,
  revision bigint not null check(revision > 0),
  body_hash text not null,
  ack jsonb not null,
  received_at timestamptz not null default now(),
  primary key(scope, report_id),
  unique(scope, scouting_id, revision)
);
create index awakening_import_revision on awakening_private.imports(scope, scouting_id, revision desc);
create table awakening_private.defenses (
  scope text not null references awakening_private.matches(scope),
  match_id uuid not null,
  tower_position text not null check(tower_position ~ '^[1-4]\.[1-6]\.[1-2]$'),
  player_name text not null,
  total_bp bigint not null check(total_bp > 0),
  heroes jsonb not null check(jsonb_array_length(heroes)=5),
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  report_id uuid not null,
  primary key(scope,match_id,tower_position),
  foreign key(scope,report_id) references awakening_private.imports(scope,report_id)
);
alter table awakening_private.matches enable row level security;
alter table awakening_private.tokens enable row level security;
alter table awakening_private.imports enable row level security;
alter table awakening_private.defenses enable row level security;
grant select,insert,update,delete on all tables in schema awakening_private to service_role;

create function public.awakening_context(p_token_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_match uuid;
begin
  select m.match_id into v_match from awakening_private.tokens t
    join awakening_private.matches m on m.scope=t.scope
    where t.token_hash=p_token_hash and t.enabled;
  if not found then return jsonb_build_object('ok',false,'status',401,'code','UNAUTHORIZED'); end if;
  return jsonb_build_object('ok',true,'match_id',v_match);
end $$;

create function public.awakening_import(p_token_hash text,p_body jsonb,p_body_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_scope text; v_match uuid; v_previous awakening_private.imports%rowtype;
  v_report uuid; v_scout uuid; v_rev bigint; v_count int; r jsonb; h jsonb;
  v_sum bigint; v_positions text[] := '{}'; v_position text; v_ack jsonb;
begin
  select t.scope into v_scope from awakening_private.tokens t where t.token_hash=p_token_hash and t.enabled for share;
  if not found then return jsonb_build_object('ok',false,'status',401,'code','UNAUTHORIZED'); end if;
  select match_id into v_match from awakening_private.matches where scope=v_scope for update;
  if p_body->>'match_id' is distinct from v_match::text then
    return jsonb_build_object('ok',false,'status',409,'code','MATCH_CHANGED');
  end if;
  if jsonb_typeof(p_body) <> 'object' or p_body->'schema_version' <> '1'::jsonb
     or jsonb_typeof(p_body->'scouting_revision') <> 'number'
     or coalesce(p_body->>'scouting_revision','') !~ '^[1-9][0-9]*$'
     or jsonb_typeof(p_body->'reports') <> 'array' then
    return jsonb_build_object('ok',false,'status',400,'code','INVALID_REPORT');
  end if;
  v_report := (p_body->>'report_id')::uuid;
  v_scout := (p_body->>'scouting_id')::uuid;
  v_rev := (p_body->>'scouting_revision')::bigint;
  v_count := jsonb_array_length(p_body->'reports');
  if v_report is null or v_scout is null or v_count < 2 or v_count > 48 or v_count%2 <> 0 then
    return jsonb_build_object('ok',false,'status',400,'code','INVALID_REPORT');
  end if;
  select * into v_previous from awakening_private.imports where scope=v_scope and report_id=v_report;
  if found then
    if v_previous.body_hash is distinct from p_body_hash then
      return jsonb_build_object('ok',false,'status',409,'code','IDEMPOTENCY_CONFLICT');
    end if;
    return v_previous.ack;
  end if;
  if exists(select 1 from awakening_private.imports where scope=v_scope and scouting_id=v_scout and revision >= v_rev) then
    return jsonb_build_object('ok',false,'status',409,'code','OUTDATED_REPORT');
  end if;
  for r in select value from jsonb_array_elements(p_body->'reports') loop
    v_position := r->>'tower_position';
    if v_position is null or v_position !~ '^[1-4]\.[1-6]\.[1-2]$' or v_position=any(v_positions)
      or jsonb_typeof(r->'player_name') is distinct from 'string' or length(btrim(r->>'player_name')) not between 1 and 512
      or jsonb_typeof(r->'total_bp') is distinct from 'number' or coalesce(r->>'total_bp','') !~ '^[1-9][0-9]*$'
      or jsonb_typeof(r->'heroes') is distinct from 'array' then
      return jsonb_build_object('ok',false,'status',400,'code','INVALID_DEFENSE');
    end if;
    v_positions := array_append(v_positions,v_position);
    if jsonb_array_length(r->'heroes') <> 5 or coalesce(r->>'captured_at','') !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$' then
      return jsonb_build_object('ok',false,'status',400,'code','INVALID_DEFENSE');
    end if;
    perform (r->>'captured_at')::timestamptz;
    v_sum := 0;
    for h in select value from jsonb_array_elements(r->'heroes') loop
      if jsonb_typeof(h->'name') is distinct from 'string' or length(btrim(h->>'name')) not between 1 and 256
        or jsonb_typeof(h->'bp') is distinct from 'number' or coalesce(h->>'bp','') !~ '^[1-9][0-9]*$'
        or not (h ? 'awakening') or (h->'awakening' <> 'null'::jsonb and h->'awakening' not in ('0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb)) then
        return jsonb_build_object('ok',false,'status',400,'code','INVALID_HERO');
      end if;
      v_sum := v_sum + (h->>'bp')::bigint;
    end loop;
    if v_sum <> (r->>'total_bp')::bigint then
      return jsonb_build_object('ok',false,'status',400,'code','BP_MISMATCH');
    end if;
  end loop;
  for v_position in select unnest(v_positions) loop
    if not (left(v_position,4)||case right(v_position,1) when '1' then '2' else '1' end)=any(v_positions) then
      return jsonb_build_object('ok',false,'status',400,'code','MISSING_PAIR');
    end if;
  end loop;
  v_ack := jsonb_build_object('ok',true,'report_id',v_report,'match_id',v_match,'accepted_count',v_count);
  insert into awakening_private.imports(scope,report_id,match_id,scouting_id,revision,body_hash,ack)
    values(v_scope,v_report,v_match,v_scout,v_rev,p_body_hash,v_ack);
  insert into awakening_private.defenses(scope,match_id,tower_position,player_name,total_bp,heroes,captured_at,report_id)
    select v_scope,v_match,x->>'tower_position',x->>'player_name',(x->>'total_bp')::bigint,x->'heroes',(x->>'captured_at')::timestamptz,v_report
    from jsonb_array_elements(p_body->'reports') x
    on conflict(scope,match_id,tower_position) do update set
      player_name=excluded.player_name,total_bp=excluded.total_bp,heroes=excluded.heroes,
      captured_at=excluded.captured_at,report_id=excluded.report_id,received_at=now();
  return v_ack;
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_datetime_format then
  return jsonb_build_object('ok',false,'status',400,'code','INVALID_REPORT');
end $$;

create function public.awakening_reset_match(p_scope text,p_expected_match uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_match uuid;
begin
  select match_id into v_match from awakening_private.matches where scope=p_scope for update;
  if not found or v_match is distinct from p_expected_match then raise exception 'MATCH_CHANGED'; end if;
  update awakening_private.matches set match_id=gen_random_uuid(),started_at=now()
    where scope=p_scope returning match_id into v_match;
  return v_match;
end $$;

revoke all on function public.awakening_context(text) from public,anon,authenticated;
revoke all on function public.awakening_import(text,jsonb,text) from public,anon,authenticated;
revoke all on function public.awakening_reset_match(text,uuid) from public,anon,authenticated;
grant execute on function public.awakening_context(text),public.awakening_import(text,jsonb,text),public.awakening_reset_match(text,uuid) to service_role;
