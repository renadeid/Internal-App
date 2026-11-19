-- org_admin is the organization-scoped Super admin role.
create table public.project_invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, project_id uuid not null, profile_id uuid not null,
 created_at timestamptz not null default now(), unique(project_id,profile_id),
 foreign key(organization_id,project_id) references public.projects(organization_id,id) on delete cascade,
 foreign key(organization_id,profile_id) references public.organization_memberships(organization_id,profile_id) on delete cascade
);
alter table public.project_invitations enable row level security;
alter table public.project_invitations force row level security;
revoke all on public.project_invitations from public,anon,authenticated;
grant select,delete on public.project_invitations to authenticated;
create policy invitations_read on public.project_invitations for select to authenticated using(profile_id=auth.uid() or private.is_org_admin(organization_id));
create policy invitations_cancel on public.project_invitations for delete to authenticated using(profile_id=auth.uid() or private.is_org_admin(organization_id));

create function public.admin_create_project(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 org uuid := (payload->>'organizationId')::uuid;
 project uuid; mode text := payload->>'accessMode'; member_id uuid;
 flags jsonb := coalesce(payload->'permissions','{}'::jsonb);
begin
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
    insert into public.project_invitations(organization_id,project_id,profile_id) values(org,project,member_id);
   end if;
  else
   insert into public.project_members(organization_id,project_id,profile_id,role,can_edit,can_manage_members,can_approve_deliverables,can_manage_assets,can_comment)
   select org,project,member_id,case when m.role='viewer' then 'viewer'::public.project_role else 'project_member'::public.project_role end,
   mode='custom' and coalesce((flags->>'edit')::boolean,false),mode='custom' and coalesce((flags->>'manageMembers')::boolean,false),mode='custom' and coalesce((flags->>'approve')::boolean,false),mode='custom' and coalesce((flags->>'manageAssets')::boolean,false),true
   from public.organization_memberships m where m.organization_id=org and m.profile_id=member_id on conflict(project_id,profile_id) do nothing;
  end if;
 end loop;
 return project;
end;
$$;
create function public.accept_project_invitation(invitation_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare inv public.project_invitations; member_role public.org_role;
begin
 select * into inv from public.project_invitations where id=invitation_id and profile_id=auth.uid() for update;
 if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 select role into member_role from public.organization_memberships where organization_id=inv.organization_id and profile_id=auth.uid();
 if member_role is null or not exists(select 1 from public.projects where id=inv.project_id and archived_at is null) then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 insert into public.project_members(organization_id,project_id,profile_id,role) values(inv.organization_id,inv.project_id,inv.profile_id,case when member_role='viewer' then 'viewer'::public.project_role else 'project_member'::public.project_role end) on conflict(project_id,profile_id) do nothing;
 delete from public.project_invitations where id=inv.id;
 return inv.project_id;
end;
$$;
create function public.admin_add_member(target_organization uuid, member_email text) returns void
language plpgsql security definer set search_path='' as $$
declare target_profile uuid;
begin
 if not private.is_org_admin(target_organization) then raise exception 'Super admin required' using errcode='42501'; end if;
 select id into target_profile from public.profiles where lower(email)=lower(btrim(member_email));
 if target_profile is null then raise exception 'No account found. Create the user first.' using errcode='22023'; end if;
 insert into public.organization_memberships(organization_id,profile_id,role) values(target_organization,target_profile,'member') on conflict(organization_id,profile_id) do nothing;
end;
$$;
revoke all on function public.admin_create_project(jsonb) from public,anon;
revoke all on function public.accept_project_invitation(uuid) from public,anon;
revoke all on function public.admin_add_member(uuid,text) from public,anon;
grant execute on function public.admin_create_project(jsonb) to authenticated;
grant execute on function public.accept_project_invitation(uuid) to authenticated;
grant execute on function public.admin_add_member(uuid,text) to authenticated;

create function public.admin_invite_project_member(target_organization uuid, target_project uuid, target_profile uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_org_admin(target_organization) then raise exception 'Super admin required' using errcode='42501'; end if;
 if not exists(select 1 from public.projects where id=target_project and organization_id=target_organization and archived_at is null)
 or not exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id=target_profile)
 or exists(select 1 from public.project_members where project_id=target_project and profile_id=target_profile)
 then raise exception 'Invalid project invitation' using errcode='22023'; end if;
 insert into public.project_invitations(organization_id,project_id,profile_id) values(target_organization,target_project,target_profile)
 on conflict(project_id,profile_id) do nothing;
end;
$$;
revoke all on function public.admin_invite_project_member(uuid,uuid,uuid) from public,anon;
grant execute on function public.admin_invite_project_member(uuid,uuid,uuid) to authenticated;

-- Show enough context to decide whether to accept, without granting project access.
create function public.my_project_invitations(target_organization uuid)
returns table(id uuid, project_id uuid, project_name text)
language sql stable security definer set search_path='' as $$
 select i.id,i.project_id,p.name from public.project_invitations i
 join public.projects p on p.id=i.project_id and p.organization_id=i.organization_id
 where i.organization_id=target_organization and i.profile_id=auth.uid()
 and private.is_org_member(target_organization) and p.archived_at is null;
$$;
revoke all on function public.my_project_invitations(uuid) from public,anon;
grant execute on function public.my_project_invitations(uuid) to authenticated;
