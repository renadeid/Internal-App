-- Per-member history visibility. Existing memberships keep their current full access.
alter table public.project_members add column history_access text not null default 'full_history'
 check(history_access in ('full_history','assigned_only'));
alter table public.project_invitations add column history_access text not null default 'full_history'
 check(history_access in ('full_history','assigned_only'));
grant update(history_access) on public.project_members to authenticated;

create function private.enforce_project_history_access() returns trigger
language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.history_access is distinct from old.history_access
 and not private.is_org_admin(new.organization_id) then
  raise exception 'Only a Super admin can change history access' using errcode='42501';
 end if;
 if new.history_access='assigned_only' then
  if exists(select 1 from public.projects where id=new.project_id and owner_id=new.profile_id) then
   raise exception 'Project owner requires full history' using errcode='23514';
  end if;
  new.can_edit=false; new.can_manage_members=false; new.can_approve_deliverables=false;
  new.can_manage_assets=false; new.can_comment=false;
 end if;
 return new;
end;
$$;
revoke all on function private.enforce_project_history_access() from public,anon,authenticated;
create trigger project_members_history_access before insert or update on public.project_members
 for each row execute function private.enforce_project_history_access();

-- Full-history helpers intentionally exclude assigned-only members. All existing child
-- policies (campaigns, deliverables, approvals, project assets and activity) use these.
create function private.can_read_assigned_task(target_project uuid, target_assignee uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select target_assignee=auth.uid() and exists(
  select 1 from public.project_members m join public.organization_memberships o
  on o.organization_id=m.organization_id and o.profile_id=m.profile_id
  where m.project_id=target_project and m.profile_id=auth.uid() and m.history_access='assigned_only'
 );
$$;
revoke all on function private.can_read_assigned_task(uuid,uuid) from public,anon;
grant execute on function private.can_read_assigned_task(uuid,uuid) to authenticated;
drop policy tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated using(
 private.can_read_project(project_id) or private.can_read_assigned_task(project_id,assignee_id)
);
-- Restricted members can open the project header and their own membership, not its history.
create function private.can_open_project(target_project uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.can_read_project(target_project) or exists(
  select 1 from public.project_members m where m.project_id=target_project and m.profile_id=auth.uid()
  and private.is_org_member(m.organization_id)
 );
$$;
revoke all on function private.can_open_project(uuid) from public,anon;
grant execute on function private.can_open_project(uuid) to authenticated;
drop policy projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated using(private.can_open_project(id));
drop policy project_members_select on public.project_members;
create policy project_members_select on public.project_members for select to authenticated
 using(private.can_read_project(project_id) or (profile_id=auth.uid() and private.is_org_member(organization_id)));

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
      and member.history_access = 'full_history'
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
      and member.history_access = 'full_history'
            and member.role <> 'viewer'
            and membership.role <> 'viewer'
        )
      )
  );
$$;

create or replace function public.admin_create_project(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 org uuid := (payload->>'organizationId')::uuid;
 project uuid; mode text := payload->>'accessMode'; member_id uuid;
 flags jsonb := coalesce(payload->'permissions','{}'::jsonb);
begin
 if coalesce(payload->>'historyAccess','full_history') not in ('full_history','assigned_only') then raise exception 'Invalid history access' using errcode='22023'; end if;
 if not private.is_org_admin(org) then raise exception 'Super admin required' using errcode='42501'; end if;
 if mode is null or mode not in ('members','department','organization','custom','invitation') then raise exception 'Invalid access mode' using errcode='22023'; end if;
 if mode in ('members','custom','invitation') and jsonb_array_length(coalesce(payload->'memberIds','[]'::jsonb))=0 then raise exception 'Select at least one member' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(payload->'memberIds','[]'::jsonb)) x(value) where not exists(select 1 from public.organization_memberships m where m.organization_id=org and m.profile_id=x.value::uuid)) then raise exception 'Member outside organization' using errcode='23503'; end if;
 insert into public.projects(organization_id,slug,name,description,lead_department_id,owner_id,starts_on,due_on)
 values(org,payload->>'slug',payload->>'name',coalesce(payload->>'description',''),(payload->>'leadDepartmentId')::uuid,(payload->>'ownerId')::uuid,nullif(payload->>'startsOn','')::date,nullif(payload->>'dueOn','')::date) returning id into project;
 for member_id in select m.profile_id from public.organization_memberships m where m.organization_id=org and (
 mode='organization' or (mode='department' and exists(select 1 from public.department_memberships d where d.organization_id=org and d.department_id=(payload->>'leadDepartmentId')::uuid and d.profile_id=m.profile_id)) or
 (mode in ('members','custom','invitation') and m.profile_id in(select value::uuid from jsonb_array_elements_text(payload->'memberIds'))))
 loop
  if mode='invitation' then
   if not exists(select 1 from public.project_members where project_id=project and profile_id=member_id) then
    insert into public.project_invitations(organization_id,project_id,profile_id,history_access) values(org,project,member_id,coalesce(payload->>'historyAccess','full_history'));
   end if;
  else
   insert into public.project_members(organization_id,project_id,profile_id,role,can_edit,can_manage_members,can_approve_deliverables,can_manage_assets,can_comment,history_access)
   select org,project,member_id,case when m.role='viewer' then 'viewer'::public.project_role else 'project_member'::public.project_role end,
   mode='custom' and coalesce((flags->>'edit')::boolean,false),mode='custom' and coalesce((flags->>'manageMembers')::boolean,false),mode='custom' and coalesce((flags->>'approve')::boolean,false),mode='custom' and coalesce((flags->>'manageAssets')::boolean,false),true,coalesce(payload->>'historyAccess','full_history')
   from public.organization_memberships m where m.organization_id=org and m.profile_id=member_id on conflict(project_id,profile_id) do nothing;
  end if;
 end loop;
 return project;
end;
$$;

create or replace function public.accept_project_invitation(invitation_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare inv public.project_invitations; member_role public.org_role;
begin
 select * into inv from public.project_invitations where id=invitation_id and profile_id=auth.uid() for update;
 if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 select role into member_role from public.organization_memberships where organization_id=inv.organization_id and profile_id=auth.uid();
 if member_role is null or not exists(select 1 from public.projects where id=inv.project_id and archived_at is null) then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 insert into public.project_members(organization_id,project_id,profile_id,role,history_access) values(inv.organization_id,inv.project_id,inv.profile_id,case when member_role='viewer' then 'viewer'::public.project_role else 'project_member'::public.project_role end,inv.history_access) on conflict(project_id,profile_id) do nothing;
 delete from public.project_invitations where id=inv.id;
 return inv.project_id;
end;
$$;

drop function public.admin_invite_project_member(uuid,uuid,uuid);
create function public.admin_invite_project_member(target_organization uuid,target_project uuid,target_profile uuid,target_history_access text default 'full_history') returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_org_admin(target_organization) then raise exception 'Super admin required' using errcode='42501'; end if;
 if target_history_access not in ('full_history','assigned_only') or target_history_access is null then raise exception 'Invalid history access' using errcode='22023'; end if;
 if not exists(select 1 from public.projects where id=target_project and organization_id=target_organization and archived_at is null)
 or not exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id=target_profile)
 or exists(select 1 from public.project_members where project_id=target_project and profile_id=target_profile)
 then raise exception 'Invalid project invitation' using errcode='22023'; end if;
 insert into public.project_invitations(organization_id,project_id,profile_id,history_access) values(target_organization,target_project,target_profile,target_history_access)
 on conflict(project_id,profile_id) do update set history_access=excluded.history_access;
end;
$$;
revoke all on function public.admin_invite_project_member(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.admin_invite_project_member(uuid,uuid,uuid,text) to authenticated;
drop function public.my_project_invitations(uuid);
create function public.my_project_invitations(target_organization uuid)
returns table(id uuid,project_id uuid,project_name text,history_access text)
language sql stable security definer set search_path='' as $$
 select i.id,i.project_id,p.name,i.history_access from public.project_invitations i
 join public.projects p on p.id=i.project_id and p.organization_id=i.organization_id
 where i.organization_id=target_organization and i.profile_id=auth.uid()
 and private.is_org_member(target_organization) and p.archived_at is null;
$$;
revoke all on function public.my_project_invitations(uuid) from public,anon;
grant execute on function public.my_project_invitations(uuid) to authenticated;
