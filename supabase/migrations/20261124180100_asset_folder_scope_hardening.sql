begin;
create or replace function public.move_asset_to_folder(target_asset uuid,target_folder uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.assets%rowtype; f public.asset_folders%rowtype;
begin
 select * into a from public.assets where id=target_asset for update;
 if not found or not private.can_read_shared_asset(a.id) or not private.can_manage_asset(a.id) then raise exception 'Edit permission required' using errcode='42501'; end if;
 if target_folder is not null then
  select * into f from public.asset_folders where id=target_folder;
  if not found or f.organization_id<>a.organization_id or not private.can_read_asset_folder(f.id) then raise exception 'Folder unavailable' using errcode='42501'; end if;
  if a.visibility<>f.visibility or (f.project_id is not null and (not exists(select 1 from public.asset_project_links where asset_id=a.id and project_id=f.project_id) or exists(select 1 from public.asset_project_links where asset_id=a.id and project_id<>f.project_id) or exists(select 1 from public.asset_campaign_links l join public.campaigns c on c.id=l.campaign_id where l.asset_id=a.id and c.project_id<>f.project_id))) then raise exception 'Folder access differs from this file. Choose a folder with the same audience, or change the file access first.' using errcode='22023'; end if;
 end if;
 update public.assets set folder_id=target_folder where id=a.id;
end; $$;
revoke all on function public.move_asset_to_folder(uuid,uuid) from public,anon;
grant execute on function public.move_asset_to_folder(uuid,uuid) to authenticated;
create or replace function private.enforce_asset_folder_scope() returns trigger
language plpgsql security definer set search_path='' as $$
declare asset_id_to_check uuid; a public.assets%rowtype; f public.asset_folders%rowtype;
begin
 if tg_table_name='assets' then asset_id_to_check:=new.id;else asset_id_to_check:=case when tg_op='DELETE' then old.asset_id else new.asset_id end;end if;
 select * into a from public.assets where id=asset_id_to_check;
 if not found or a.folder_id is null then return null;end if;
 select * into f from public.asset_folders where id=a.folder_id;
 if f.organization_id<>a.organization_id or a.visibility<>f.visibility or (f.project_id is not null and (not exists(select 1 from public.asset_project_links where asset_id=a.id and project_id=f.project_id) or exists(select 1 from public.asset_project_links where asset_id=a.id and project_id<>f.project_id) or exists(select 1 from public.asset_campaign_links l join public.campaigns c on c.id=l.campaign_id where l.asset_id=a.id and c.project_id<>f.project_id))) then raise exception 'File access must match its folder. Move the file out before changing access.' using errcode='23514';end if;
 return null;
end; $$;
revoke all on function private.enforce_asset_folder_scope() from public,anon,authenticated;
create constraint trigger asset_folder_scope after insert or update or delete on public.asset_campaign_links deferrable initially deferred for each row execute function private.enforce_asset_folder_scope();
commit;
