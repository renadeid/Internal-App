-- Explicit task selection in invitations, with optional status-only work access.
alter table public.project_members add column can_update_assigned_status boolean not null default false;
alter table public.project_invitations add column can_update_assigned_status boolean not null default false;
alter table public.project_invitations add column task_ids uuid[] not null default '{}';
grant update(can_update_assigned_status) on public.project_members to authenticated;

create function private.protect_assigned_status_permission() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (TG_OP='UPDATE' and new.can_update_assigned_status is distinct from old.can_update_assigned_status)
 or (TG_OP='INSERT' and new.can_update_assigned_status) then
  if not private.is_org_admin(new.organization_id) and not
    (TG_OP='INSERT' and new.profile_id=auth.uid() and private.operation_is_open('accept_task_invitation',new.project_id)) then
   raise exception 'Only Super admin can grant assigned-task status access' using errcode='42501';
  end if;
 end if;
 if new.history_access<>'assigned_only' or new.role='viewer'
 or exists(select 1 from public.organization_memberships where organization_id=new.organization_id and profile_id=new.profile_id and role='viewer') then
  new.can_update_assigned_status=false;
 end if;
 return new;
end;
$$;
revoke all on function private.protect_assigned_status_permission() from public,anon,authenticated;
create trigger project_members_assigned_status_permission before insert or update on public.project_members
for each row execute function private.protect_assigned_status_permission();

create or replace function public.admin_invite_project_member(target_organization uuid,target_project uuid,target_profile uuid,target_history_access text default 'full_history') returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_org_admin(target_organization) then raise exception 'Super admin required' using errcode='42501'; end if;
 if target_history_access not in ('full_history','assigned_only') or target_history_access is null then raise exception 'Invalid history access' using errcode='22023'; end if;
 if not exists(select 1 from public.projects where id=target_project and organization_id=target_organization and archived_at is null)
 or not exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id=target_profile)
 or exists(select 1 from public.project_members where project_id=target_project and profile_id=target_profile)
 then raise exception 'Invalid project invitation' using errcode='22023'; end if;
 insert into public.project_invitations(organization_id,project_id,profile_id,history_access) values(target_organization,target_project,target_profile,target_history_access)
 on conflict(project_id,profile_id) do update set history_access=excluded.history_access,task_ids='{}',can_update_assigned_status=false;
end;
$$;

create function public.admin_invite_project_tasks(target_organization uuid,target_project uuid,target_profile uuid,
 target_history_access text,selected_tasks uuid[],allow_status_update boolean)
returns void language plpgsql security definer set search_path='' as $$
declare selected_task uuid;
begin
 if selected_tasks is null or allow_status_update is null or cardinality(selected_tasks)>100 then
  raise exception 'Choose up to 100 tasks' using errcode='22023'; end if;
 if target_history_access<>'assigned_only' and (cardinality(selected_tasks)>0 or allow_status_update) then
  raise exception 'Task options require assigned-tasks-only access' using errcode='22023'; end if;
 perform public.admin_invite_project_member(target_organization,target_project,target_profile,target_history_access);
 if allow_status_update and exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id=target_profile and role='viewer') then
  raise exception 'Viewers cannot change task status' using errcode='22023'; end if;
 foreach selected_task in array selected_tasks loop
  perform id from public.tasks where id=selected_task and organization_id=target_organization and project_id=target_project
   and archived_at is null and (assignee_id is null or assignee_id=target_profile) for update;
  if not found then raise exception 'A selected task is unavailable or assigned to someone else' using errcode='22023'; end if;
 end loop;
 update public.project_invitations set task_ids=selected_tasks,can_update_assigned_status=allow_status_update
 where organization_id=target_organization and project_id=target_project and profile_id=target_profile;
end;
$$;
revoke all on function public.admin_invite_project_tasks(uuid,uuid,uuid,text,uuid[],boolean) from public,anon;
grant execute on function public.admin_invite_project_tasks(uuid,uuid,uuid,text,uuid[],boolean) to authenticated;

create or replace function public.accept_project_invitation(invitation_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare inv public.project_invitations; member_role public.org_role; selected_task uuid;
begin
 select * into inv from public.project_invitations where id=invitation_id and profile_id=auth.uid() for update;
 if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 select role into member_role from public.organization_memberships where organization_id=inv.organization_id and profile_id=auth.uid() for share;
 if member_role is null then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 perform id from public.projects where id=inv.project_id and organization_id=inv.organization_id and archived_at is null for update;
 if not found or exists(select 1 from public.project_members where project_id=inv.project_id and profile_id=auth.uid()) then
  raise exception 'Invitation unavailable' using errcode='42501'; end if;
 foreach selected_task in array inv.task_ids loop
  perform id from public.tasks where id=selected_task and project_id=inv.project_id and organization_id=inv.organization_id
   and archived_at is null and (assignee_id is null or assignee_id=inv.profile_id) for update;
  if not found then raise exception 'A selected task changed. Ask Super admin to resend the invitation.' using errcode='22023'; end if;
 end loop;
 perform private.open_operation('accept_task_invitation',inv.project_id);
 insert into public.project_members(organization_id,project_id,profile_id,role,history_access,can_update_assigned_status)
 values(inv.organization_id,inv.project_id,inv.profile_id,case when member_role='viewer' then 'viewer'::public.project_role else 'project_member'::public.project_role end,
 inv.history_access,inv.can_update_assigned_status and member_role<>'viewer');
 update public.tasks set assignee_id=inv.profile_id where project_id=inv.project_id and organization_id=inv.organization_id and id=any(inv.task_ids);
 delete from public.project_invitations where id=inv.id;
 return inv.project_id;
end;
$$;

create function public.set_assigned_task_status(target_organization uuid,target_project uuid,target_task uuid,next_status public.task_status)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if next_status is null then raise exception 'Choose a status' using errcode='22023'; end if;
 perform p.id from public.projects p join public.project_members m on m.project_id=p.id and m.organization_id=p.organization_id
 join public.organization_memberships o on o.organization_id=m.organization_id and o.profile_id=m.profile_id
 where p.id=target_project and p.organization_id=target_organization and p.archived_at is null
 and m.profile_id=auth.uid() and m.history_access='assigned_only' and m.can_update_assigned_status and m.role<>'viewer' and o.role<>'viewer' for share of p,m,o;
 if not found then raise exception 'Assigned task status permission required' using errcode='42501'; end if;
 perform private.open_operation('assigned_task_status',target_task);
 update public.tasks set status=next_status where id=target_task and organization_id=target_organization
 and project_id=target_project and assignee_id=auth.uid() and archived_at is null;
 return found;
end;
$$;
revoke all on function public.set_assigned_task_status(uuid,uuid,uuid,public.task_status) from public,anon;
grant execute on function public.set_assigned_task_status(uuid,uuid,uuid,public.task_status) to authenticated;

-- Preserve the old inbox RPC contract; expose task summaries separately.
create function public.my_project_task_invitations(target_organization uuid)
returns table(id uuid,can_update_assigned_status boolean,task_titles text[])
language sql stable security definer set search_path='' as $$
 select i.id,i.can_update_assigned_status,array(select t.title from public.tasks t where t.id=any(i.task_ids) and t.project_id=i.project_id and t.organization_id=i.organization_id order by t.title)
 from public.project_invitations i join public.projects p on p.id=i.project_id and p.organization_id=i.organization_id
 where i.profile_id=auth.uid() and i.organization_id=target_organization and private.is_org_member(target_organization) and p.archived_at is null;
$$;
revoke all on function public.my_project_task_invitations(uuid) from public,anon;
grant execute on function public.my_project_task_invitations(uuid) to authenticated;
create or replace function private.enforce_team_lead_task_limits() returns trigger
language plpgsql security definer set search_path='' as $$
declare org uuid; project uuid;
begin
 if TG_OP='UPDATE' and (private.operation_is_open('assigned_task_status',new.id) or private.operation_is_open('accept_task_invitation',new.project_id)) then return new; end if;
 org := case when TG_OP='DELETE' then old.organization_id else new.organization_id end;
 if exists(select 1 from public.organization_memberships where organization_id=org
   and profile_id=auth.uid() and role::text='team_lead') then
  if TG_OP='DELETE' then
   raise exception 'Team leads cannot delete tasks' using errcode='42501';
  end if;
  if (TG_OP='INSERT' and new.archived_at is not null)
    or (TG_OP='UPDATE' and (new.archived_at is distinct from old.archived_at or old.archived_at is not null)) then
   raise exception 'Team leads cannot archive, restore or edit archived tasks' using errcode='42501';
  end if;
  if TG_OP='UPDATE' and new.project_id is distinct from old.project_id then
   raise exception 'Tasks cannot be moved between projects by team leads' using errcode='42501';
  end if;
  select id into project from public.projects where id=new.project_id and organization_id=org and archived_at is null for share;
  if not found or not exists(select 1 from public.project_members where project_id=project
    and organization_id=org and profile_id=auth.uid() and role<>'viewer' and history_access='full_history') then
   raise exception 'Full project access is required to assign tasks' using errcode='42501';
  end if;
  if new.assignee_id is not null and not exists(select 1 from public.organization_memberships
    where organization_id=org and profile_id=new.assignee_id) then
   raise exception 'Assignee must belong to this organization' using errcode='42501';
  end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end;
$$;
revoke all on function private.enforce_team_lead_task_limits() from public,anon,authenticated;

