-- Admin: organization-scoped view/edit of existing work; no creation, deletion,
-- archive/restore, membership administration or permission changes.
-- org_admin remains the existing Super admin role.
create function private.is_edit_only_admin(target_organization uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m
 where m.organization_id=target_organization and m.profile_id=auth.uid() and m.role::text='admin');
$$;
revoke all on function private.is_edit_only_admin(uuid) from public,anon;
grant execute on function private.is_edit_only_admin(uuid) to authenticated;

create function private.enforce_admin_work_limits() returns trigger
language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 org := case when TG_OP='DELETE' then old.organization_id else new.organization_id end;
 if private.is_edit_only_admin(org) then
  if TG_OP in ('INSERT','DELETE') then
   raise exception 'Admin can view and edit existing work only' using errcode='42501';
  end if;
  if new.archived_at is distinct from old.archived_at then
   raise exception 'Admin cannot archive or restore work' using errcode='42501';
  end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end;
$$;
revoke all on function private.enforce_admin_work_limits() from public,anon,authenticated;

-- Restrictive policies cannot be bypassed by an older project membership that
-- grants creation or membership-management capabilities.
do $$
declare table_name text;
begin
 foreach table_name in array array['departments','organization_memberships','department_memberships',
 'projects','project_departments','project_members','campaigns','tasks','deliverables','approval_requests',
 'assets','asset_access','asset_project_links','asset_campaign_links','asset_versions','asset_comments',
 'activity_events','notifications','project_invitations'] loop
  execute format('create policy admin_no_insert on public.%I as restrictive for insert to authenticated with check (not private.is_edit_only_admin(organization_id))',table_name);
  if table_name <> 'project_invitations' then
   execute format('create policy admin_no_delete on public.%I as restrictive for delete to authenticated using (not private.is_edit_only_admin(organization_id))',table_name);
  end if;
 end loop;
 foreach table_name in array array['organization_memberships','department_memberships','project_members'] loop
  execute format('create policy admin_no_permission_update on public.%I as restrictive for update to authenticated using (not private.is_edit_only_admin(organization_id)) with check (not private.is_edit_only_admin(organization_id))',table_name);
 end loop;
 foreach table_name in array array['projects','campaigns','tasks','deliverables','assets'] loop
  execute format('create trigger admin_work_limits before insert or update or delete on public.%I for each row execute function private.enforce_admin_work_limits()',table_name);
 end loop;
end;
$$;
create policy admin_no_organization_insert on public.organizations as restrictive
 for insert to authenticated with check (not private.is_edit_only_admin(id));
create policy admin_no_organization_delete on public.organizations as restrictive
 for delete to authenticated using (not private.is_edit_only_admin(id));
create policy admin_organization_update on public.organizations for update to authenticated
 using (private.is_edit_only_admin(id)) with check (private.is_edit_only_admin(id));
create policy admin_department_update on public.departments for update to authenticated
 using (private.is_edit_only_admin(organization_id)) with check (private.is_edit_only_admin(organization_id));

create or replace function private.can_read_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = target_project
      and (
        (private.is_org_admin(project.organization_id) or private.is_edit_only_admin(project.organization_id))
        or exists (
          select 1
          from public.project_members member
          where member.project_id = project.id
            and member.profile_id = (select auth.uid())
      and member.history_access = 'full_history'
        )
      )
  );
$$;

create or replace function private.can_write_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = target_project
      and (
        (private.is_org_admin(project.organization_id) or private.is_edit_only_admin(project.organization_id))
        or exists (
          select 1
          from public.project_members member
          join public.organization_memberships membership
            on membership.organization_id = member.organization_id
           and membership.profile_id = member.profile_id
          where member.project_id = project.id
            and member.profile_id = (select auth.uid())
      and member.history_access = 'full_history'
            and member.role <> 'viewer'
            and membership.role <> 'viewer'
        )
      )
  );
$$;

create or replace function private.can_read_asset(target_asset uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assets asset
    where asset.id = target_asset
      and (
        (private.is_org_admin(asset.organization_id) or private.is_edit_only_admin(asset.organization_id))
        or asset.owner_id = (select auth.uid())
        or (
          asset.visibility = 'company'
          and private.is_org_member(asset.organization_id)
        )
        or (
          asset.visibility = 'restricted'
          and exists (
            select 1
            from public.asset_access access_row
            where access_row.asset_id = asset.id
              and access_row.profile_id = (select auth.uid())
          )
        )
        or (
          asset.visibility = 'project_members'
          and (
            exists (
              select 1
              from public.asset_project_links link
              where link.asset_id = asset.id
                and private.can_read_project(link.project_id)
            )
            or exists (
              select 1
              from public.asset_campaign_links link
              join public.campaigns campaign on campaign.id = link.campaign_id
              where link.asset_id = asset.id
                and private.can_read_project(campaign.project_id)
            )
          )
        )
      )
  );
$$;

create or replace function private.can_manage_asset(target_asset uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assets asset
    where asset.id = target_asset
      and (
        (private.is_org_admin(asset.organization_id) or private.is_edit_only_admin(asset.organization_id))
        or private.owner_can_write_asset(asset.id)
        or exists (
          select 1
          from public.asset_project_links link
          where link.asset_id = asset.id
            and private.project_flag(link.project_id, 'manage_assets')
        )
        or exists (
          select 1
          from public.asset_campaign_links link
          join public.campaigns campaign on campaign.id = link.campaign_id
          where link.asset_id = asset.id
            and private.project_flag(campaign.project_id, 'manage_assets')
        )
      )
  );
$$;

create or replace function private.can_resolve_comment(target_comment uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.asset_comments comment
    join public.assets asset on asset.id = comment.asset_id
    where comment.id = target_comment
      and (
        (private.is_org_admin(asset.organization_id) or private.is_edit_only_admin(asset.organization_id))
        or (
          not exists (
            select 1
            from public.organization_memberships membership
            where membership.organization_id = asset.organization_id
              and membership.profile_id = (select auth.uid())
              and membership.role = 'viewer'
          )
          and (
            comment.author_id = (select auth.uid())
            or asset.owner_id = (select auth.uid())
            or exists (
              select 1
              from public.asset_project_links link
              join public.project_members member on member.project_id = link.project_id
              where link.asset_id = asset.id
                and member.profile_id = (select auth.uid())
                and member.role = 'project_manager'
            )
          )
        )
      )
  );
$$;

create or replace function private.project_flag(target_project uuid, flag_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members member
    join public.organization_memberships membership
      on membership.organization_id = member.organization_id
     and membership.profile_id = member.profile_id
    where member.project_id = target_project
      and member.profile_id = (select auth.uid())
      and member.history_access = 'full_history'
      and not private.is_edit_only_admin(member.organization_id)
      and member.role <> 'viewer'
      and membership.role <> 'viewer'
      and case flag_name
        when 'edit' then member.can_edit
        when 'manage_members' then member.can_manage_members
        when 'approve_deliverables' then member.can_approve_deliverables
        when 'manage_assets' then member.can_manage_assets
        when 'comment' then member.can_comment
        else false
      end
  )
  or (
    flag_name in ('edit', 'manage_members', 'manage_assets', 'comment')
    and exists (
      select 1
      from public.projects project
      where project.id = target_project
        and (private.is_org_admin(project.organization_id) or (private.is_edit_only_admin(project.organization_id) and flag_name in ('edit','manage_assets','comment')))
    )
  );
$$;

create or replace function public.add_asset_version(
  target_asset uuid,
  version_label text,
  version_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset_row public.assets%rowtype;
  next_number integer;
  version_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in is required' using errcode = '42501';
  end if;
  if version_label is null or char_length(btrim(version_label)) = 0 then
    raise exception 'version label is required' using errcode = '22023';
  end if;

  select *
  into asset_row
  from public.assets
  where id = target_asset
  for update;

  if not found or not private.can_read_asset(asset_row.id) then
    raise exception 'asset not found' using errcode = 'P0002';
  end if;
  if private.is_edit_only_admin(asset_row.organization_id) then
    raise exception 'Admin cannot create asset versions' using errcode='42501';
  end if;
  if not private.can_manage_asset(asset_row.id) then
    raise exception 'not allowed to add a version' using errcode = '42501';
  end if;

  select coalesce(max(number), 0) + 1
  into next_number
  from public.asset_versions
  where asset_id = asset_row.id;

  insert into public.asset_versions (
    organization_id, asset_id, number, label, notes, author_id
  )
  values (
    asset_row.organization_id,
    asset_row.id,
    next_number,
    btrim(version_label),
    coalesce(version_notes, ''),
    auth.uid()
  )
  returning id into version_id;

  return version_id;
end;
$$;
