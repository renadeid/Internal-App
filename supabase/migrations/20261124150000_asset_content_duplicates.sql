begin;
create table private.asset_file_fingerprints (
 version_id uuid primary key references public.asset_versions(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$')
);
alter table private.asset_file_fingerprints enable row level security;
create index asset_file_fingerprint_lookup on private.asset_file_fingerprints(organization_id,content_hash);
revoke all on private.asset_file_fingerprints from public,anon,authenticated;
create or replace function public.shared_asset_content_exists(target_organization uuid,proposed_hash text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.asset_file_fingerprints f join public.asset_versions v on v.id=f.version_id join public.assets a on a.id=v.asset_id where f.organization_id=target_organization and f.content_hash=proposed_hash and a.archived_at is null);
$$;
revoke all on function public.shared_asset_content_exists(uuid,text) from public,anon,authenticated;
grant execute on function public.shared_asset_content_exists(uuid,text) to service_role;
create or replace function public.backfill_asset_fingerprint(target_version uuid,verified_hash text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if verified_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid fingerprint'; end if;
 insert into private.asset_file_fingerprints(version_id,organization_id,content_hash)
 select id,organization_id,verified_hash from public.asset_versions where id=target_version and storage_bucket='shared-assets' and storage_path is not null
 on conflict(version_id) do nothing;
end; $$;
revoke all on function public.backfill_asset_fingerprint(uuid,text) from public,anon,authenticated;
grant execute on function public.backfill_asset_fingerprint(uuid,text) to service_role;
create or replace function public.register_shared_asset(actor uuid,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare org uuid; asset uuid; ver uuid; project uuid; access_mode text; actor_role text; storage_key text;
begin
 org:=(payload->>'organizationId')::uuid; asset:=(payload->>'assetId')::uuid; ver:=(payload->>'versionId')::uuid;
 project:=nullif(payload->>'projectId','')::uuid; access_mode:=payload->>'visibility';
 if actor is null or org is null or asset is null or ver is null then raise exception 'Invalid upload'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select role::text into actor_role from public.organization_memberships where organization_id=org and profile_id=actor;
 if actor_role is null or actor_role in ('admin','viewer') then raise exception 'Upload denied' using errcode='42501'; end if;
 if access_mode not in ('company','project_members') or (access_mode='project_members' and project is null) then raise exception 'Choose file access' using errcode='22023'; end if;
 if project is not null and not exists(select 1 from public.projects p where p.id=project and p.organization_id=org and p.archived_at is null and private.project_flag(p.id,'manage_assets')) then raise exception 'Project upload denied' using errcode='42501'; end if;
 if length(btrim(coalesce(payload->>'name','')))=0 or length(payload->>'name')>120 or length(coalesce(payload->>'description',''))>4000 or length(btrim(coalesce(payload->>'fileName','')))=0 then raise exception 'Invalid file details' using errcode='22023'; end if;
 if (payload->>'size')::bigint not between 1 and 20971520 then raise exception 'Invalid size' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('shared-asset:'||asset::text,0));
 if exists(select 1 from public.assets a join public.asset_versions v on v.asset_id=a.id where a.id=asset and a.organization_id=org and a.owner_id=actor and v.id=ver) then return asset; end if;
 if coalesce(payload->>'contentHash','') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid file fingerprint'; end if;
 perform pg_advisory_xact_lock(hashtextextended('asset-content:'||org::text||':'||(payload->>'contentHash'),0));
 if public.shared_asset_content_exists(org,payload->>'contentHash') then raise exception 'This file is already uploaded, even if its name is different.' using errcode='23505'; end if;
 storage_key:=org::text||'/'||asset::text||'/v1/'||ver::text;
 insert into public.assets(id,organization_id,slug,name,description,type,tags,owner_id,visibility,collection)
 values(asset,org,'file-'||asset::text,btrim(payload->>'name'),coalesce(payload->>'description',''),(payload->>'type')::public.asset_type,
 array(select jsonb_array_elements_text(coalesce(payload->'tags','[]'::jsonb))),actor,access_mode::public.asset_visibility,coalesce(nullif(btrim(payload->>'collection'),''),'General'));
 if project is not null then insert into public.asset_project_links(organization_id,project_id,asset_id) values(org,project,asset); end if;
 perform private.open_operation('asset_storage',ver);
 insert into public.asset_versions(id,organization_id,asset_id,number,label,notes,author_id,storage_bucket,storage_path,mime_type,byte_size)
 values(ver,org,asset,1,payload->>'fileName','',actor,'shared-assets',storage_key,payload->>'mime',(payload->>'size')::bigint);
 insert into private.asset_file_fingerprints(version_id,organization_id,content_hash) values(ver,org,payload->>'contentHash');
 perform private.close_operation('asset_storage',ver);
 return asset;
end; $$;
revoke all on function public.register_shared_asset(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.register_shared_asset(uuid,jsonb) to service_role;

commit;
