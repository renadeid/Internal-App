-- Row Level Security policies and deliverable transitions.
-- Not applied to the remote project in this phase.
-- Helpers use auth.uid(). They do not accept an actor id.
-- Department managers do not gain project access or approval rights by title.
-- Approvals require can_approve_deliverables, except organization admins.
-- Only an organization admin may set that flag. Project managers cannot.
-- Transition and notification writes open private.operation_guard for one statement,
-- then close it before returning. Clients cannot open that table.
-- Storage bucket policies are intentionally not included yet.

create or replace function private.is_org_member(target_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization
      and membership.profile_id = (select auth.uid())
  );
$$;

create or replace function private.is_org_admin(target_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization
      and membership.profile_id = (select auth.uid())
      and membership.role = 'org_admin'
  );
$$;

create or replace function private.is_department_manager(target_organization uuid, target_department uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.department_memberships membership
    join public.organization_memberships org_membership
      on org_membership.organization_id = membership.organization_id
     and org_membership.profile_id = membership.profile_id
    where membership.organization_id = target_organization
      and membership.department_id = target_department
      and membership.profile_id = (select auth.uid())
      and membership.role = 'manager'
      and org_membership.role <> 'viewer'
  );
$$;

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
        private.is_org_admin(project.organization_id)
        or exists (
          select 1
          from public.project_members member
          where member.project_id = project.id
            and member.profile_id = (select auth.uid())
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
        and private.is_org_admin(project.organization_id)
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
        private.is_org_admin(project.organization_id)
        or exists (
          select 1
          from public.project_members member
          join public.organization_memberships membership
            on membership.organization_id = member.organization_id
           and membership.profile_id = member.profile_id
          where member.project_id = project.id
            and member.profile_id = (select auth.uid())
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
        private.is_org_admin(asset.organization_id)
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

create or replace function private.owner_can_write_asset(target_asset uuid)
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
      and asset.owner_id = (select auth.uid())
      and not exists (
        select 1
        from public.organization_memberships membership
        where membership.organization_id = asset.organization_id
          and membership.profile_id = (select auth.uid())
          and membership.role = 'viewer'
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
        private.is_org_admin(asset.organization_id)
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

create or replace function private.can_comment_on_asset(target_asset uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_read_asset(target_asset)
    and exists (
      select 1
      from public.assets asset
      where asset.id = target_asset
        and (
          private.is_org_admin(asset.organization_id)
          or private.owner_can_write_asset(asset.id)
          or exists (
            select 1
            from public.asset_project_links link
            where link.asset_id = asset.id
              and private.project_flag(link.project_id, 'comment')
          )
          or exists (
            select 1
            from public.asset_campaign_links link
            join public.campaigns campaign on campaign.id = link.campaign_id
            where link.asset_id = asset.id
              and private.project_flag(campaign.project_id, 'comment')
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
        private.is_org_admin(asset.organization_id)
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

revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.is_org_admin(uuid) from public;
revoke all on function private.is_department_manager(uuid, uuid) from public;
revoke all on function private.can_read_project(uuid) from public;
revoke all on function private.project_flag(uuid, text) from public;
revoke all on function private.can_write_project(uuid) from public;
revoke all on function private.can_read_asset(uuid) from public;
revoke all on function private.owner_can_write_asset(uuid) from public;
revoke all on function private.can_manage_asset(uuid) from public;
revoke all on function private.can_comment_on_asset(uuid) from public;
revoke all on function private.can_resolve_comment(uuid) from public;

grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;
grant execute on function private.is_department_manager(uuid, uuid) to authenticated;
grant execute on function private.can_read_project(uuid) to authenticated;
grant execute on function private.project_flag(uuid, text) to authenticated;
grant execute on function private.can_write_project(uuid) to authenticated;
grant execute on function private.can_read_asset(uuid) to authenticated;
grant execute on function private.owner_can_write_asset(uuid) to authenticated;
grant execute on function private.can_manage_asset(uuid) to authenticated;
grant execute on function private.can_comment_on_asset(uuid) to authenticated;
grant execute on function private.can_resolve_comment(uuid) to authenticated;

revoke all on function private.operation_is_open(text, uuid) from public, anon, authenticated;
revoke all on function private.open_operation(text, uuid) from public, anon, authenticated;
revoke all on function private.close_operation(text, uuid) from public, anon, authenticated;
grant execute on function private.operation_is_open(text, uuid) to authenticated;

create or replace function private.enforce_member_flags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'viewer' then
    new.can_edit = false;
    new.can_manage_members = false;
    new.can_approve_deliverables = false;
    new.can_manage_assets = false;
    new.can_comment = false;
  end if;

  if current_user in ('authenticated', 'anon') and new.can_approve_deliverables then
    if tg_op = 'INSERT' then
      if not private.is_org_admin(new.organization_id) then
        raise exception 'only an organization admin can grant deliverable approval'
          using errcode = '42501';
      end if;
    elsif new.can_approve_deliverables is distinct from old.can_approve_deliverables
      and not private.is_org_admin(new.organization_id) then
      raise exception 'only an organization admin can grant deliverable approval'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;

grant select, insert on public.departments to authenticated;
grant update (name, slug) on public.departments to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, job_title, avatar_color, initials) on public.profiles to authenticated;

grant select, insert, delete on public.organization_memberships to authenticated;
grant update (role) on public.organization_memberships to authenticated;

grant select, insert, delete on public.department_memberships to authenticated;
grant update (role) on public.department_memberships to authenticated;

grant select, insert on public.projects to authenticated;
grant update (
  slug, name, description, lead_department_id, status, owner_id, starts_on, due_on, archived_at
) on public.projects to authenticated;

grant select, insert, delete on public.project_departments to authenticated;

grant select, insert, delete on public.project_members to authenticated;
grant update (
  role, can_edit, can_manage_members, can_approve_deliverables, can_manage_assets, can_comment
) on public.project_members to authenticated;

grant select, insert on public.campaigns to authenticated;
grant update (
  slug, name, description, goals, owner_id, type, status, starts_on, ends_on, archived_at
) on public.campaigns to authenticated;

grant select, insert on public.tasks to authenticated;
grant update (
  campaign_id, title, description, assignee_id, priority, status, due_on, archived_at
) on public.tasks to authenticated;

grant select, insert on public.deliverables to authenticated;
grant update (title, type, due_on, asset_id, archived_at) on public.deliverables to authenticated;

grant select on public.approval_requests to authenticated;

grant select, insert on public.assets to authenticated;
grant update (
  slug, name, description, type, external_url, tags, visibility, collection, archived_at
) on public.assets to authenticated;

grant select, insert, delete on public.asset_access to authenticated;
grant select, insert, delete on public.asset_project_links to authenticated;
grant select, insert, delete on public.asset_campaign_links to authenticated;
grant select on public.asset_versions to authenticated;
grant select, insert on public.asset_comments to authenticated;
grant update (resolved_at) on public.asset_comments to authenticated;
grant select on public.activity_events to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy organizations_select on public.organizations
  for select to authenticated
  using (private.is_org_member(id));

create policy organizations_update on public.organizations
  for update to authenticated
  using (private.is_org_admin(id))
  with check (private.is_org_admin(id));

create policy departments_select on public.departments
  for select to authenticated
  using (private.is_org_member(organization_id));

create policy departments_insert on public.departments
  for insert to authenticated
  with check (private.is_org_admin(organization_id));

create policy departments_update on public.departments
  for update to authenticated
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id));

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.organization_memberships mine
      join public.organization_memberships theirs
        on theirs.organization_id = mine.organization_id
      where mine.profile_id = (select auth.uid())
        and theirs.profile_id = profiles.id
    )
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy organization_memberships_select on public.organization_memberships
  for select to authenticated
  using (private.is_org_member(organization_id));

create policy organization_memberships_insert on public.organization_memberships
  for insert to authenticated
  with check (private.is_org_admin(organization_id));

create policy organization_memberships_update on public.organization_memberships
  for update to authenticated
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id));

create policy organization_memberships_delete on public.organization_memberships
  for delete to authenticated
  using (private.is_org_admin(organization_id));

create policy department_memberships_select on public.department_memberships
  for select to authenticated
  using (private.is_org_member(organization_id));

create policy department_memberships_insert on public.department_memberships
  for insert to authenticated
  with check (private.is_org_admin(organization_id));

create policy department_memberships_update on public.department_memberships
  for update to authenticated
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id));

create policy department_memberships_delete on public.department_memberships
  for delete to authenticated
  using (private.is_org_admin(organization_id));

create policy projects_select on public.projects
  for select to authenticated
  using (private.can_read_project(id));

create policy projects_insert on public.projects
  for insert to authenticated
  with check (
    private.is_org_admin(organization_id)
    or private.is_department_manager(organization_id, lead_department_id)
  );

create policy projects_update on public.projects
  for update to authenticated
  using (private.project_flag(id, 'edit'))
  with check (private.project_flag(id, 'edit'));

create policy project_departments_select on public.project_departments
  for select to authenticated
  using (private.can_read_project(project_id));

create policy project_departments_insert on public.project_departments
  for insert to authenticated
  with check (private.project_flag(project_id, 'edit'));

create policy project_departments_delete on public.project_departments
  for delete to authenticated
  using (
    private.project_flag(project_id, 'edit')
    and not exists (
      select 1
      from public.projects project
      where project.id = project_departments.project_id
        and project.lead_department_id = project_departments.department_id
    )
  );

create policy project_members_select on public.project_members
  for select to authenticated
  using (private.can_read_project(project_id));

create policy project_members_insert on public.project_members
  for insert to authenticated
  with check (private.project_flag(project_id, 'manage_members'));

create policy project_members_update on public.project_members
  for update to authenticated
  using (private.project_flag(project_id, 'manage_members'))
  with check (private.project_flag(project_id, 'manage_members'));

create policy project_members_delete on public.project_members
  for delete to authenticated
  using (private.project_flag(project_id, 'manage_members'));

create policy campaigns_select on public.campaigns
  for select to authenticated
  using (private.can_read_project(project_id));

create policy campaigns_insert on public.campaigns
  for insert to authenticated
  with check (private.can_write_project(project_id));

create policy campaigns_update on public.campaigns
  for update to authenticated
  using (private.can_write_project(project_id))
  with check (private.can_write_project(project_id));

create policy tasks_select on public.tasks
  for select to authenticated
  using (private.can_read_project(project_id));

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (private.can_write_project(project_id));

create policy tasks_update on public.tasks
  for update to authenticated
  using (private.can_write_project(project_id))
  with check (private.can_write_project(project_id));

create policy deliverables_select on public.deliverables
  for select to authenticated
  using (private.can_read_project(project_id));

create policy deliverables_insert on public.deliverables
  for insert to authenticated
  with check (
    private.can_write_project(project_id)
    and creator_id = (select auth.uid())
  );

create policy deliverables_update on public.deliverables
  for update to authenticated
  using (
    private.project_flag(project_id, 'edit')
    or (
      creator_id = (select auth.uid())
      and private.can_write_project(project_id)
    )
  )
  with check (
    private.project_flag(project_id, 'edit')
    or (
      creator_id = (select auth.uid())
      and private.can_write_project(project_id)
    )
  );

create policy approval_requests_select on public.approval_requests
  for select to authenticated
  using (private.can_read_project(project_id));

create policy assets_select on public.assets
  for select to authenticated
  using (private.can_read_asset(id));

create policy assets_insert on public.assets
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and not exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = assets.organization_id
        and membership.profile_id = (select auth.uid())
        and membership.role = 'viewer'
    )
  );

create policy assets_update on public.assets
  for update to authenticated
  using (private.can_manage_asset(id))
  with check (private.can_manage_asset(id));

create policy asset_access_select on public.asset_access
  for select to authenticated
  using (private.can_read_asset(asset_id));

create policy asset_access_insert on public.asset_access
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.assets asset
      where asset.id = asset_access.asset_id
        and asset.organization_id = asset_access.organization_id
        and (
          private.owner_can_write_asset(asset.id)
          or private.is_org_admin(asset.organization_id)
        )
    )
  );

create policy asset_access_delete on public.asset_access
  for delete to authenticated
  using (
    exists (
      select 1
      from public.assets asset
      where asset.id = asset_access.asset_id
        and (
          private.owner_can_write_asset(asset.id)
          or private.is_org_admin(asset.organization_id)
        )
    )
  );

create policy asset_project_links_select on public.asset_project_links
  for select to authenticated
  using (private.can_read_asset(asset_id));

create policy asset_project_links_insert on public.asset_project_links
  for insert to authenticated
  with check (
    private.can_read_project(project_id)
    and (
      private.project_flag(project_id, 'manage_assets')
      or exists (
        select 1
        from public.assets asset
        where asset.id = asset_project_links.asset_id
          and asset.organization_id = asset_project_links.organization_id
          and private.owner_can_write_asset(asset.id)
      )
    )
  );

create policy asset_project_links_delete on public.asset_project_links
  for delete to authenticated
  using (
    private.can_read_project(project_id)
    and (
      private.project_flag(project_id, 'manage_assets')
      or exists (
        select 1
        from public.assets asset
        where asset.id = asset_project_links.asset_id
          and private.owner_can_write_asset(asset.id)
      )
    )
  );

create policy asset_campaign_links_select on public.asset_campaign_links
  for select to authenticated
  using (private.can_read_asset(asset_id));

create policy asset_campaign_links_insert on public.asset_campaign_links
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.campaigns campaign
      join public.assets asset on asset.id = asset_campaign_links.asset_id
      where campaign.id = asset_campaign_links.campaign_id
        and campaign.organization_id = asset_campaign_links.organization_id
        and asset.organization_id = asset_campaign_links.organization_id
        and private.can_read_project(campaign.project_id)
        and (
          private.project_flag(campaign.project_id, 'manage_assets')
          or private.owner_can_write_asset(asset.id)
        )
    )
  );

create policy asset_campaign_links_delete on public.asset_campaign_links
  for delete to authenticated
  using (
    exists (
      select 1
      from public.campaigns campaign
      join public.assets asset on asset.id = asset_campaign_links.asset_id
      where campaign.id = asset_campaign_links.campaign_id
        and private.can_read_project(campaign.project_id)
        and (
          private.project_flag(campaign.project_id, 'manage_assets')
          or private.owner_can_write_asset(asset.id)
        )
    )
  );

create policy asset_versions_select on public.asset_versions
  for select to authenticated
  using (private.can_read_asset(asset_id));

create policy asset_comments_select on public.asset_comments
  for select to authenticated
  using (private.can_read_asset(asset_id));

create policy asset_comments_insert on public.asset_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.can_comment_on_asset(asset_id)
  );

create policy asset_comments_update on public.asset_comments
  for update to authenticated
  using (private.can_resolve_comment(id))
  with check (private.can_resolve_comment(id));

create policy activity_events_select on public.activity_events
  for select to authenticated
  using (
    (
      project_id is null
      and private.is_org_member(organization_id)
    )
    or private.can_read_project(project_id)
  );

create policy notifications_select on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy notifications_update on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create or replace function private.transition_deliverable(
  target_id uuid,
  next_status public.deliverable_status,
  next_action public.approval_action,
  allowed_from public.deliverable_status[],
  is_review boolean,
  review_note text
)
returns public.deliverable_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.deliverables%rowtype;
  activity_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in is required' using errcode = '42501';
  end if;

  select *
  into current_row
  from public.deliverables
  where id = target_id
  for update;

  if not found or not private.can_read_project(current_row.project_id) then
    raise exception 'deliverable not found' using errcode = 'P0002';
  end if;

  if is_review then
    if not (
      private.is_org_admin(current_row.organization_id)
      or private.project_flag(current_row.project_id, 'approve_deliverables')
    ) then
      raise exception 'not allowed to review this deliverable' using errcode = '42501';
    end if;
  elsif current_row.creator_id is distinct from auth.uid()
    or not private.can_write_project(current_row.project_id) then
    raise exception 'not allowed to change this deliverable' using errcode = '42501';
  end if;

  if not (current_row.status = any (allowed_from)) then
    raise exception 'deliverable cannot make that transition' using errcode = 'P0001';
  end if;

  perform private.open_operation('deliverable_status', current_row.id);
  update public.deliverables
  set status = next_status
  where id = current_row.id;
  perform private.close_operation('deliverable_status', current_row.id);

  perform private.open_operation('approval', current_row.id);
  insert into public.approval_requests (
    organization_id, deliverable_id, project_id, action, from_status, to_status, actor_id, note
  )
  values (
    current_row.organization_id,
    current_row.id,
    current_row.project_id,
    next_action,
    current_row.status,
    next_status,
    auth.uid(),
    coalesce(review_note, '')
  );
  perform private.close_operation('approval', current_row.id);

  activity_id := pg_catalog.gen_random_uuid();
  perform private.open_operation('activity', activity_id);
  insert into public.activity_events (
    id, organization_id, actor_id, verb, summary, project_id, campaign_id, deliverable_id
  )
  values (
    activity_id,
    current_row.organization_id,
    auth.uid(),
    case next_action
      when 'approve' then 'approved'
      when 'submit' then 'submitted'
      else 'updated'
    end,
    case next_action
      when 'approve' then 'approved “' || current_row.title || '”'
      when 'request_changes' then 'requested changes on “' || current_row.title || '”'
      when 'submit' then 'submitted “' || current_row.title || '”'
      else 'updated “' || current_row.title || '”'
    end,
    current_row.project_id,
    current_row.campaign_id,
    current_row.id
  );
  perform private.close_operation('activity', activity_id);

  return next_status;
end;
$$;

create or replace function public.start_deliverable(deliverable_id uuid)
returns public.deliverable_status
language sql
security definer
set search_path = ''
as $$
  select private.transition_deliverable(
    deliverable_id,
    'in_progress',
    'start',
    array['draft', 'changes_requested']::public.deliverable_status[],
    false,
    ''
  );
$$;

create or replace function public.submit_deliverable(deliverable_id uuid)
returns public.deliverable_status
language sql
security definer
set search_path = ''
as $$
  select private.transition_deliverable(
    deliverable_id,
    'submitted',
    'submit',
    array['draft', 'in_progress', 'changes_requested']::public.deliverable_status[],
    false,
    ''
  );
$$;

create or replace function public.review_deliverable(
  deliverable_id uuid,
  decision text,
  note text default ''
)
returns public.deliverable_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.deliverable_status;
  next_action public.approval_action;
begin
  if decision = 'approved' then
    next_status = 'approved';
    next_action = 'approve';
  elsif decision = 'changes_requested' then
    next_status = 'changes_requested';
    next_action = 'request_changes';
  else
    raise exception 'decision must be approved or changes_requested' using errcode = '22023';
  end if;

  return private.transition_deliverable(
    deliverable_id,
    next_status,
    next_action,
    array['submitted']::public.deliverable_status[],
    true,
    note
  );
end;
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

create or replace function private.fanout_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is null then
    return null;
  end if;

  perform private.open_operation('notification', new.id);
  insert into public.notifications (organization_id, recipient_id, activity_event_id, title)
  select new.organization_id, member.profile_id, new.id, new.summary
  from public.project_members member
  where member.project_id = new.project_id
    and member.profile_id is distinct from new.actor_id;
  perform private.close_operation('notification', new.id);

  return null;
end;
$$;

create trigger activity_events_fanout_notifications
  after insert on public.activity_events
  for each row execute function private.fanout_notifications();

revoke all on function private.transition_deliverable(uuid, public.deliverable_status, public.approval_action, public.deliverable_status[], boolean, text) from public, anon, authenticated;
revoke all on function private.fanout_notifications() from public, anon, authenticated;
revoke all on function public.start_deliverable(uuid) from public, anon;
revoke all on function public.submit_deliverable(uuid) from public, anon;
revoke all on function public.review_deliverable(uuid, text, text) from public, anon;
revoke all on function public.add_asset_version(uuid, text, text) from public, anon;

grant execute on function public.start_deliverable(uuid) to authenticated;
grant execute on function public.submit_deliverable(uuid) to authenticated;
grant execute on function public.review_deliverable(uuid, text, text) to authenticated;
grant execute on function public.add_asset_version(uuid, text, text) to authenticated;
