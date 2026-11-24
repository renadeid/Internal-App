begin;
create or replace function private.asset_name_key(value text) returns text
language sql immutable set search_path='' as $$ select lower(btrim(regexp_replace(value,'[[:space:]]+',' ','g'))); $$;
revoke all on function private.asset_name_key(text) from public,anon,authenticated;
create or replace function private.guard_unique_asset_name() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.archived_at is not null then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended('asset-name:'||new.organization_id::text||':'||private.asset_name_key(new.name),0));
 if exists(select 1 from public.assets a where a.organization_id=new.organization_id and a.id<>new.id and a.archived_at is null and private.asset_name_key(a.name)=private.asset_name_key(new.name)) then
  raise exception 'An asset with this name is already uploaded. Choose a different name.' using errcode='23505',constraint='assets_active_name_unique';
 end if;
 return new;
end; $$;
revoke all on function private.guard_unique_asset_name() from public,anon,authenticated;
create trigger unique_asset_name_guard before insert or update of name,organization_id,archived_at on public.assets for each row execute function private.guard_unique_asset_name();
create or replace function public.shared_asset_name_exists(target_organization uuid,proposed_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.assets a where a.organization_id=target_organization and a.archived_at is null and private.asset_name_key(a.name)=private.asset_name_key(proposed_name));
$$;
revoke all on function public.shared_asset_name_exists(uuid,text) from public,anon,authenticated;
grant execute on function public.shared_asset_name_exists(uuid,text) to service_role;
commit;
