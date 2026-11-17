-- Rollback-only smoke test for the Supabase SQL Editor.
-- Run this whole file once. It does not read or write application tables or auth users.
-- Success is a result row plus ROLLBACK, and two notices: role anon, then role authenticated.
-- An error before ROLLBACK means stop and run rollback; before any other statement.

begin;

do $session_role$
begin
  if not pg_catalog.pg_has_role(current_user, 'anon', 'SET')
    or not pg_catalog.pg_has_role(current_user, 'authenticated', 'SET') then
    raise exception 'session user % cannot set role anon and authenticated', current_user;
  end if;
end
$session_role$;

create or replace function pg_temp.whoami()
returns text
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select current_user::text;
$$;

do $grant_temp$
declare
  temp_schema name;
begin
  select nspname
  into temp_schema
  from pg_namespace
  where oid = pg_catalog.pg_my_temp_schema();

  if temp_schema is null then
    raise exception 'temporary schema was not created for the smoke-test helper';
  end if;

  execute format('grant usage on schema %I to anon, authenticated', temp_schema);
end
$grant_temp$;

grant execute on function pg_temp.whoami() to anon, authenticated;

set local role anon;
do $check_anon$
declare
  active_role text := pg_temp.whoami();
begin
  if active_role is distinct from 'anon' then
    raise exception 'expected active role anon, got %', active_role;
  end if;
  raise notice 'smoke test role: %', active_role;
end
$check_anon$;
reset role;

set local role authenticated;
do $check_authenticated$
declare
  active_role text := pg_temp.whoami();
begin
  if active_role is distinct from 'authenticated' then
    raise exception 'expected active role authenticated, got %', active_role;
  end if;
  raise notice 'smoke test role: %', active_role;
end
$check_authenticated$;
reset role;

select 'anon and authenticated called pg_temp.whoami' as smoke_test;

rollback;
