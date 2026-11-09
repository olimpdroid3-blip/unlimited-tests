-- Dedicated service-only licensing data. Optimistic compare-and-swap makes
-- the small alliance's limits, requests, revocation and audit atomic.
create table public.wor_state(
 id boolean primary key default true check(id), revision bigint not null default 0,
 data jsonb not null default '{"requests":[],"members":[],"devices":[],"sessions":[],"releases":[],"tables":[],"audit":[],"settings":{"device_limit":2,"clan_chat_id":"-1003978316922","confirmation_thread_id":6,"owner_id":"302364492"}}'::jsonb
);
alter table public.wor_state enable row level security;
revoke all on public.wor_state from public,anon,authenticated;
grant select,update on public.wor_state to service_role;
insert into public.wor_state(id) values(true);
create function public.wor_cas(expected bigint,replacement jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 update public.wor_state set data=replacement,revision=revision+1 where id and revision=expected;
 return found;
end $$;
revoke all on function public.wor_cas(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.wor_cas(bigint,jsonb) to service_role;

create table public.wor_rate(key text primary key, window_end timestamptz not null, attempts integer not null);
alter table public.wor_rate enable row level security;
revoke all on public.wor_rate from public,anon,authenticated;
grant select,insert,update,delete on public.wor_rate to service_role;
create function public.wor_rate_take(k text,max_attempts integer,seconds integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into public.wor_rate values(k,now()+make_interval(secs=>seconds),1)
 on conflict(key) do update set
 attempts=case when public.wor_rate.window_end<now() then 1 else public.wor_rate.attempts+1 end,
 window_end=case when public.wor_rate.window_end<now() then now()+make_interval(secs=>seconds) else public.wor_rate.window_end end returning attempts into n;
 return n<=max_attempts;
end $$;
revoke all on function public.wor_rate_take(text,integer,integer) from public,anon,authenticated;
grant execute on function public.wor_rate_take(text,integer,integer) to service_role;

-- The sole SECURITY DEFINER RPC is necessary to access encrypted Vault.
-- No client role may execute it; service-role JWT is checked as well.
create function public.wor_license_key(candidate text default null) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(728419051);
 select decrypted_secret into result from vault.decrypted_secrets where name='wor_license_ed25519_pkcs8';
 if result is null and candidate is not null then
  perform vault.create_secret(candidate,'wor_license_ed25519_pkcs8','License signing only. Never use for updates.');result:=candidate;
 end if;
 return result;
end $$;
revoke all on function public.wor_license_key(text) from public,anon,authenticated;
grant execute on function public.wor_license_key(text) to service_role;

create table public.wor_backups(id bigint generated always as identity primary key,created_at timestamptz not null default now(),revision bigint not null,data jsonb not null);
alter table public.wor_backups enable row level security;
revoke all on public.wor_backups from public,anon,authenticated;
grant select,insert on public.wor_backups to service_role;
grant usage on sequence public.wor_backups_id_seq to service_role;
create function public.wor_snapshot() returns void language sql security invoker set search_path='' as $$
 insert into public.wor_backups(revision,data) select revision,data from public.wor_state;
$$;
revoke all on function public.wor_snapshot() from public,anon,authenticated;
grant execute on function public.wor_snapshot() to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('wor-private','wor-private',false,52428800,array['application/octet-stream','application/json']);
-- Existing bucket-specific policies grant no access to wor-private.
select cron.schedule('wor-daily-snapshot','15 2 * * *',$job$
 insert into public.wor_backups(revision,data) select revision,data from public.wor_state;
 delete from public.wor_backups where created_at<now()-interval '35 days';
 delete from public.wor_rate where window_end<now()-interval '1 hour';
 $job$);
