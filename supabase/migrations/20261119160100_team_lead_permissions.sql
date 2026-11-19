-- Team leads inherit ordinary member access, never organization-wide access.
-- Task writers must have full-history non-viewer project membership.
-- Existing task rules require every assignee to already be a project member.
create function private.enforce_team_lead_task_limits() returns trigger
language plpgsql security definer set search_path='' as $$
declare org uuid; project uuid;
begin
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
create trigger team_lead_task_limits before insert or update or delete on public.tasks
for each row execute function private.enforce_team_lead_task_limits();
