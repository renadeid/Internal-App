-- Shared asset files: existing RLS remains authoritative for read/edit access.
-- File bytes live in the private shared-assets bucket; no public Storage policies are added.
begin;

create or replace function private.can_read_shared_asset(target_asset uuid) returns boolean
language sql stable security definer set search_path='' as $body$
 select exists(select 1 from public.assets a where a.id=target_asset and private.is_org_member(a.organization_id) and private.can_read_asset(a.id)
 and (a.visibility<>'project_members' or private.is_org_admin(a.organization_id) or private.is_edit_only_admin(a.organization_id)
 or exists(select 1 from public.asset_project_links l where l.asset_id=a.id and private.can_read_project(l.project_id))
 or exists(select 1 from public.asset_campaign_links l join public.campaigns c on c.id=l.campaign_id where l.asset_id=a.id and private.can_read_project(c.project_id))));
$body$;
revoke all on function private.can_read_shared_asset(uuid) from public,anon;
grant execute on function private.can_read_shared_asset(uuid) to authenticated;


create or replace function public.shared_asset_upload_access(target_organization uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor_role text;
begin
 select role::text into actor_role from public.organization_memberships where organization_id=target_organization and profile_id=auth.uid();
 if actor_role is null then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 return jsonb_build_object('role',actor_role,'canUpload',actor_role not in ('admin','viewer'),'projects',coalesce((
  select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) from public.projects p
  where p.organization_id=target_organization and p.archived_at is null and private.project_flag(p.id,'manage_assets')
 ),'[]'::jsonb));
end; $$;
revoke all on function public.shared_asset_upload_access(uuid) from public,anon;
grant execute on function public.shared_asset_upload_access(uuid) to authenticated;

create or replace function public.list_shared_assets(target_organization uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_org_member(target_organization) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(item order by stamp desc) from (
  select a.updated_at stamp,jsonb_build_object('id',a.id,'name',a.name,'description',a.description,'type',a.type,
   'tags',a.tags,'collection',a.collection,'visibility',a.visibility,'ownerId',a.owner_id,'ownerName',p.full_name,
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

-- Database guards also protect access changes made outside the application UI.
create or replace function private.guard_shared_asset_access() returns trigger
language plpgsql security definer set search_path='' as $guard$
begin
 if auth.uid() is not null and (new.visibility is distinct from old.visibility or new.owner_id is distinct from old.owner_id)
 and not private.is_org_admin(old.organization_id)
 and exists(select 1 from public.asset_versions v where v.asset_id=old.id and v.storage_bucket='shared-assets') then
  raise exception 'Only Super admin can change shared file access or ownership' using errcode='42501';
 end if;
 return new;
end; $guard$;
revoke all on function private.guard_shared_asset_access() from public,anon,authenticated;
drop trigger if exists shared_asset_access_guard on public.assets;
create trigger shared_asset_access_guard before update on public.assets for each row execute function private.guard_shared_asset_access();
create or replace function private.guard_shared_asset_links() returns trigger
language plpgsql security definer set search_path='' as $guard$
declare target_asset uuid; org uuid;
begin
 target_asset:=case when TG_OP='DELETE' then old.asset_id else new.asset_id end;
 org:=case when TG_OP='DELETE' then old.organization_id else new.organization_id end;
 if auth.uid() is not null and not private.is_org_admin(org) and exists(select 1 from public.asset_versions v where v.asset_id=target_asset and v.storage_bucket='shared-assets') then
  raise exception 'Only Super admin can change shared file project access' using errcode='42501';
 end if;
 if TG_OP='DELETE' then return old; end if; return new;
end; $guard$;
revoke all on function private.guard_shared_asset_links() from public,anon,authenticated;
drop trigger if exists shared_asset_link_guard on public.asset_project_links;
create trigger shared_asset_link_guard before insert or delete on public.asset_project_links for each row execute function private.guard_shared_asset_links();
drop trigger if exists shared_asset_link_guard on public.asset_campaign_links;
create trigger shared_asset_link_guard before insert or delete on public.asset_campaign_links for each row execute function private.guard_shared_asset_links();

-- Only the server's verified upload finalizer can call this function.
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
 storage_key:=org::text||'/'||asset::text||'/v1/'||ver::text;
 insert into public.assets(id,organization_id,slug,name,description,type,tags,owner_id,visibility,collection)
 values(asset,org,'file-'||asset::text,btrim(payload->>'name'),coalesce(payload->>'description',''),(payload->>'type')::public.asset_type,
 array(select jsonb_array_elements_text(coalesce(payload->'tags','[]'::jsonb))),actor,access_mode::public.asset_visibility,coalesce(nullif(btrim(payload->>'collection'),''),'General'));
 if project is not null then insert into public.asset_project_links(organization_id,project_id,asset_id) values(org,project,asset); end if;
 perform private.open_operation('asset_storage',ver);
 insert into public.asset_versions(id,organization_id,asset_id,number,label,notes,author_id,storage_bucket,storage_path,mime_type,byte_size)
 values(ver,org,asset,1,payload->>'fileName','',actor,'shared-assets',storage_key,payload->>'mime',(payload->>'size')::bigint);
 perform private.close_operation('asset_storage',ver);
 return asset;
end; $$;
revoke all on function public.register_shared_asset(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.register_shared_asset(uuid,jsonb) to service_role;

create or replace function public.edit_shared_asset(target_asset uuid,details jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare a public.assets%rowtype; next_project uuid; next_visibility text;
begin
 select * into a from public.assets where id=target_asset for update;
 if not found or not private.can_read_shared_asset(a.id) or not private.can_manage_asset(a.id) or a.archived_at is not null then raise exception 'Edit denied' using errcode='42501'; end if;
 if length(btrim(coalesce(details->>'name','')))=0 or length(details->>'name')>120 or length(coalesce(details->>'description',''))>4000 then raise exception 'Invalid details' using errcode='22023'; end if;
 if details ? 'visibility' or details ? 'projectId' then
  if not private.is_org_admin(a.organization_id) then raise exception 'Only Super admin can change file access' using errcode='42501'; end if;
  next_visibility:=details->>'visibility'; next_project:=nullif(details->>'projectId','')::uuid;
  if next_visibility not in ('company','project_members') or next_visibility is null or (next_visibility='project_members' and next_project is null) then raise exception 'Choose file access' using errcode='22023'; end if;
  if next_project is not null and not exists(select 1 from public.projects p where p.id=next_project and p.organization_id=a.organization_id and p.archived_at is null) then raise exception 'Project unavailable' using errcode='42501'; end if;
  delete from public.asset_project_links where asset_id=a.id;
  if next_project is not null then insert into public.asset_project_links(organization_id,asset_id,project_id) values(a.organization_id,a.id,next_project); end if;
  update public.assets set visibility=next_visibility::public.asset_visibility where id=a.id;
  update public.viewer_links set revoked_at=now() where organization_id=a.organization_id and resource_id=a.id::text and kind='asset' and revoked_at is null;
 end if;
 update public.assets set name=btrim(details->>'name'),description=coalesce(details->>'description',''),
 tags=array(select jsonb_array_elements_text(coalesce(details->'tags','[]'::jsonb))),collection=coalesce(nullif(btrim(details->>'collection'),''),'General') where id=a.id;
end; $$;
revoke all on function public.edit_shared_asset(uuid,jsonb) from public,anon;
grant execute on function public.edit_shared_asset(uuid,jsonb) to authenticated;

create or replace function public.delete_shared_asset(target_asset uuid,confirmation_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.assets%rowtype; files jsonb;
begin
 select * into a from public.assets where id=target_asset for update;
 if not found or not private.is_org_admin(a.organization_id) then raise exception 'Super admin required' using errcode='42501'; end if;
 if confirmation_name is distinct from a.name then raise exception 'Type the asset name' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',storage_bucket,'path',storage_path)),'[]'::jsonb) into files
 from public.asset_versions where asset_id=a.id and storage_bucket='shared-assets' and storage_path is not null;
 update public.viewer_links set revoked_at=now() where organization_id=a.organization_id and kind='asset' and resource_id=a.id::text and revoked_at is null;
 delete from public.assets where id=a.id;
 return files;
end; $$;
revoke all on function public.delete_shared_asset(uuid,text) from public,anon;
grant execute on function public.delete_shared_asset(uuid,text) to authenticated;

-- New shared-file links snapshot the selected file version; old preview-asset links still work.
create or replace function public.create_viewer_link(target_organization uuid,target_resource text,resource_kind text,link_token text,asset_snapshot jsonb default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare content jsonb; result uuid;
begin
 if not private.is_org_admin(target_organization) then raise exception 'Super admin required' using errcode='42501'; end if;
 if resource_kind='project' then
  select jsonb_build_object('title',p.name,'description',p.description,'status',p.status,'due',p.due_on,
   'tasks',coalesce((select jsonb_agg(jsonb_build_object('title',t.title,'description',t.description,'status',t.status,'due',t.due_on) order by t.created_at)
    from public.tasks t where t.project_id=p.id and t.organization_id=p.organization_id and t.archived_at is null),'[]'::jsonb)) into content
  from public.projects p where p.id::text=target_resource and p.organization_id=target_organization and p.archived_at is null;
 elsif resource_kind='asset' then
  select jsonb_build_object('title',a.name,'description',a.description,'type',a.type,'sharedAssetId',a.id,'versionId',v.id,'url',coalesce(a.external_url,'')) into content
  from public.assets a left join lateral(select id from public.asset_versions where asset_id=a.id and storage_bucket='shared-assets' and storage_path is not null order by number desc limit 1)v on true
  where a.id::text=target_resource and a.organization_id=target_organization and a.archived_at is null;
  if content is null then
   if target_resource ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Asset unavailable' using errcode='22023'; end if;
   if coalesce(length(btrim(asset_snapshot->>'title')),0)=0 or length(asset_snapshot::text)>20000 then raise exception 'Invalid asset' using errcode='22023'; end if;
   content:=jsonb_build_object('title',asset_snapshot->>'title','description',asset_snapshot->>'description','url',asset_snapshot->>'url','type',asset_snapshot->>'type');
  end if;
 else raise exception 'Invalid kind' using errcode='22023'; end if;
 if content is null then raise exception 'Resource unavailable' using errcode='22023'; end if;
 insert into public.viewer_links(organization_id,resource_id,kind,token,snapshot,created_by) values(target_organization,target_resource,resource_kind,link_token,content,auth.uid()) returning id into result;
 return result;
end; $$;

create or replace function public.read_viewer_link(link_token text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('kind',l.kind,'content',l.snapshot,'expires',l.expires_at) from public.viewer_links l
 where l.token=link_token and l.revoked_at is null and l.expires_at>now()
 and (l.kind<>'project' or exists(select 1 from public.projects p where p.id::text=l.resource_id and p.organization_id=l.organization_id and p.archived_at is null))
 and (l.snapshot->>'sharedAssetId' is null or exists(select 1 from public.assets a where a.id::text=l.snapshot->>'sharedAssetId' and a.organization_id=l.organization_id and a.archived_at is null));
$$;
create or replace function public.shared_asset_file(target_asset uuid,target_version uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('organizationId',a.organization_id,'assetId',a.id,'versionId',v.id,'number',v.number,'bucket',v.storage_bucket,'path',v.storage_path,'fileName',v.label,'mime',v.mime_type,'size',v.byte_size)
 from public.assets a join lateral(select * from public.asset_versions av where av.asset_id=a.id and (target_version is null or av.id=target_version) and av.storage_bucket='shared-assets' and av.storage_path is not null order by av.number desc limit 1)v on true
 where a.id=target_asset and a.archived_at is null and private.is_org_member(a.organization_id) and private.can_read_shared_asset(a.id);
$$;
revoke all on function public.shared_asset_file(uuid,uuid) from public,anon;
grant execute on function public.shared_asset_file(uuid,uuid) to authenticated;
commit;
