begin;
create table public.asset_folders(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 80),visibility public.asset_visibility not null,
 project_id uuid,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),
 unique(organization_id,id),foreign key(organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
 check(visibility='company' and project_id is null or visibility='project_members' and project_id is not null)
);
create unique index asset_folder_name_unique on public.asset_folders(organization_id,private.asset_name_key(name));
alter table public.asset_folders enable row level security;
alter table public.assets add column folder_id uuid;
alter table public.assets add constraint asset_folder_organization_fkey foreign key(organization_id,folder_id) references public.asset_folders(organization_id,id) on delete restrict;
create index assets_folder_id_idx on public.assets(folder_id);
create or replace function private.can_read_asset_folder(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.asset_folders f where f.id=target and private.is_org_member(f.organization_id) and (f.visibility='company' or private.is_org_admin(f.organization_id) or private.is_edit_only_admin(f.organization_id) or private.can_read_project(f.project_id)));
$$;
revoke all on function private.can_read_asset_folder(uuid) from public,anon;
grant execute on function private.can_read_asset_folder(uuid) to authenticated;
create policy asset_folder_read on public.asset_folders for select to authenticated using(private.can_read_asset_folder(id));
revoke all on public.asset_folders from public,anon,authenticated;
grant select on public.asset_folders to authenticated;
create or replace function public.create_asset_folder(target_organization uuid,folder_name text,folder_project uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; actor_role text;
begin
 select role::text into actor_role from public.organization_memberships where organization_id=target_organization and profile_id=auth.uid();
 if actor_role is null or actor_role in ('admin','viewer') then raise exception 'Upload permission required' using errcode='42501'; end if;
 if folder_project is not null and not exists(select 1 from public.projects where id=folder_project and organization_id=target_organization and archived_at is null and private.can_read_project(id) and private.project_flag(id,'manage_assets')) then raise exception 'Project file access required' using errcode='42501'; end if;
 if length(btrim(coalesce(folder_name,''))) not between 1 and 80 then raise exception 'Enter a folder name of up to 80 characters'; end if;
 insert into public.asset_folders(organization_id,name,visibility,project_id,created_by) values(target_organization,btrim(folder_name),case when folder_project is null then 'company'::public.asset_visibility else 'project_members'::public.asset_visibility end,folder_project,auth.uid()) returning id into result;
 return result;
end; $$;
revoke all on function public.create_asset_folder(uuid,text,uuid) from public,anon;
grant execute on function public.create_asset_folder(uuid,text,uuid) to authenticated;
create or replace function public.move_asset_to_folder(target_asset uuid,target_folder uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.assets%rowtype; f public.asset_folders%rowtype;
begin
 select * into a from public.assets where id=target_asset for update;
 if not found or not private.can_read_shared_asset(a.id) or not private.can_manage_asset(a.id) then raise exception 'Edit permission required' using errcode='42501'; end if;
 if target_folder is not null then
  select * into f from public.asset_folders where id=target_folder;
  if not found or f.organization_id<>a.organization_id or not private.can_read_asset_folder(f.id) then raise exception 'Folder unavailable' using errcode='42501'; end if;
  if a.visibility<>f.visibility or (f.project_id is not null and not exists(select 1 from public.asset_project_links where asset_id=a.id and project_id=f.project_id)) then raise exception 'Folder access differs from this file. Choose a folder with the same audience, or change the file access first.' using errcode='22023'; end if;
 end if;
 update public.assets set folder_id=target_folder where id=a.id;
end; $$;
revoke all on function public.move_asset_to_folder(uuid,uuid) from public,anon;
grant execute on function public.move_asset_to_folder(uuid,uuid) to authenticated;
-- Prevent raw updates or later audience/link edits from bypassing folder scope.
create or replace function private.enforce_asset_folder_scope() returns trigger
language plpgsql security definer set search_path='' as $$
declare asset_id_to_check uuid; a public.assets%rowtype; f public.asset_folders%rowtype;
begin
 if tg_table_name='assets' then asset_id_to_check:=new.id;else asset_id_to_check:=case when tg_op='DELETE' then old.asset_id else new.asset_id end;end if;
 select * into a from public.assets where id=asset_id_to_check;
 if not found or a.folder_id is null then return null;end if;
 select * into f from public.asset_folders where id=a.folder_id;
 if f.organization_id<>a.organization_id or a.visibility<>f.visibility or (f.project_id is not null and not exists(select 1 from public.asset_project_links where asset_id=a.id and project_id=f.project_id)) then raise exception 'File access must match its folder. Move the file out before changing access.' using errcode='23514';end if;
 return null;
end; $$;
revoke all on function private.enforce_asset_folder_scope() from public,anon,authenticated;
create constraint trigger asset_folder_scope after insert or update on public.assets deferrable initially deferred for each row execute function private.enforce_asset_folder_scope();
create constraint trigger asset_folder_scope after insert or update or delete on public.asset_project_links deferrable initially deferred for each row execute function private.enforce_asset_folder_scope();
create or replace function public.list_shared_assets(target_organization uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_org_member(target_organization) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(item order by stamp desc) from (
  select a.updated_at stamp,jsonb_build_object('id',a.id,'name',a.name,'description',a.description,'type',a.type,
   'folderId',a.folder_id,'tags',a.tags,'collection',a.collection,'visibility',a.visibility,'ownerId',a.owner_id,'ownerName',p.full_name,
   'createdAt',a.created_at,'updatedAt',a.updated_at,'externalUrl',a.external_url,
   'canEdit',private.can_manage_asset(a.id),'canDelete',private.is_org_admin(a.organization_id),
   'versionId',v.id,'fileName',v.label,'mime',v.mime_type,'size',v.byte_size,
   'hasFile',coalesce(v.storage_bucket='shared-assets' and v.storage_path is not null,false),
   'projects',coalesce((select jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.name) order by pr.name)
     from public.asset_project_links l join public.projects pr on pr.id=l.project_id and pr.organization_id=l.organization_id
     where l.asset_id=a.id and private.can_read_project(pr.id)),'[]'::jsonb)
  ) item
  from public.assets a left join public.profiles p on p.id=a.owner_id
  left join lateral (select * from public.asset_versions av where av.asset_id=a.id and av.storage_bucket='shared-assets' order by av.number desc limit 1) v on true
  where a.organization_id=target_organization and a.archived_at is null and private.can_read_shared_asset(a.id)
 ) rows),'[]'::jsonb);
end; $$;
revoke all on function public.list_shared_assets(uuid) from public,anon;
grant execute on function public.list_shared_assets(uuid) to authenticated;

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
 if nullif(payload->>'folderId','') is not null then perform public.move_asset_to_folder(asset,(payload->>'folderId')::uuid); end if;
 return asset;
end; $$;
revoke all on function public.register_shared_asset(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.register_shared_asset(uuid,jsonb) to service_role;

commit;
