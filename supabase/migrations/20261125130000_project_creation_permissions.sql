begin;

create table public.project_creation_grants (
 organization_id uuid not null,
 profile_id uuid not null,
 granted_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key (organization_id, profile_id),
 foreign key (organization_id, profile_id) references public.organization_memberships(organization_id, profile_id) on delete cascade
);
alter table public.project_creation_grants enable row level security;
revoke all on public.project_creation_grants from public, anon, authenticated;
grant select on public.project_creation_grants to authenticated;

create function private.can_manage_project_creation(target_organization uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id=auth.uid() and role::text in ('org_admin','team_lead'));
$$;
revoke all on function private.can_manage_project_creation(uuid) from public,anon;
grant execute on function private.can_manage_project_creation(uuid) to authenticated;

create policy project_creation_grants_select on public.project_creation_grants for select to authenticated
 using (private.is_org_member(organization_id) and (profile_id=auth.uid() or private.can_manage_project_creation(organization_id)));

create function public.has_project_creation_permission(target_organization uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.project_creation_grants g join public.organization_memberships m using(organization_id,profile_id)
 where g.organization_id=target_organization and g.profile_id=auth.uid() and m.role::text='member');
$$;
revoke all on function public.has_project_creation_permission(uuid) from public,anon;
grant execute on function public.has_project_creation_permission(uuid) to authenticated;

create function public.set_project_creation_permission(target_organization uuid,target_profile uuid,allow_creation boolean) returns void
language plpgsql security definer set search_path='' as $$
declare actor_role text; member_role text;
begin
 select role::text into actor_role from public.organization_memberships where organization_id=target_organization and profile_id=auth.uid() for share;
 if actor_role is null or actor_role not in ('org_admin','team_lead') then raise exception 'Team lead or Super admin permission is required' using errcode='42501'; end if;
 select role::text into member_role from public.organization_memberships where organization_id=target_organization and profile_id=target_profile for update;
 if member_role is null or member_role<>'member' or allow_creation is null then raise exception 'Choose a current Member in this workspace' using errcode='22023'; end if;
 if allow_creation then
  insert into public.project_creation_grants(organization_id,profile_id,granted_by) values(target_organization,target_profile,auth.uid()) on conflict(organization_id,profile_id) do nothing;
 else
  delete from public.project_creation_grants where organization_id=target_organization and profile_id=target_profile;
 end if;
end;
$$;
revoke all on function public.set_project_creation_permission(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_project_creation_permission(uuid,uuid,boolean) to authenticated;

create function private.clear_project_creation_grant_on_role_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.role is distinct from old.role then delete from public.project_creation_grants where organization_id=old.organization_id and profile_id=old.profile_id; end if;
 return new;
end;
$$;
revoke all on function private.clear_project_creation_grant_on_role_change() from public,anon,authenticated;
create trigger clear_project_creation_grant after update of role on public.organization_memberships for each row execute function private.clear_project_creation_grant_on_role_change();

create function private.can_create_organization_project(target_organization uuid,target_department uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_org_admin(target_organization)
 or public.has_project_creation_permission(target_organization)
 or (exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id=auth.uid() and role::text='team_lead') and private.is_department_manager(target_organization,target_department));
$$;
revoke all on function private.can_create_organization_project(uuid,uuid) from public,anon;
grant execute on function private.can_create_organization_project(uuid,uuid) to authenticated;

drop policy projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated with check (private.can_create_organization_project(organization_id,lead_department_id));
create policy project_creation_gate on public.projects as restrictive for insert to authenticated with check (private.can_create_organization_project(organization_id,lead_department_id));

notify pgrst,'reload schema';
commit;
