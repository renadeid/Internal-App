begin;
create or replace function public.transfer_departing_employee_work(actor uuid,target_organization uuid,departing_employee uuid,recipient uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receiver_role text; item record; project_count integer; campaign_count integer; asset_count integer; task_count integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('employee-departure:'||departing_employee::text,0));
 if actor=departing_employee or recipient=departing_employee then raise exception 'Choose another employee to receive this work'; end if;
 if not exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id=actor and role='org_admin') then raise exception 'Super admin required' using errcode='42501'; end if;
 if not exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id=departing_employee) or exists(select 1 from public.organization_memberships where profile_id=departing_employee and organization_id<>target_organization) then raise exception 'Employee workspace could not be verified'; end if;
 select role::text into receiver_role from public.organization_memberships where organization_id=target_organization and profile_id=recipient for update;
 if receiver_role is null or receiver_role='viewer' then raise exception 'Choose a current employee who can manage work'; end if;
 if exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id=departing_employee and role='org_admin') and not exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id<>departing_employee and role='org_admin') then raise exception 'The workspace must retain a Super admin'; end if;
 if exists(select 1 from public.deliverables where creator_id=departing_employee) or exists(select 1 from public.approval_requests where actor_id=departing_employee) or exists(select 1 from public.asset_versions where author_id=departing_employee) or exists(select 1 from public.asset_comments where author_id=departing_employee) then raise exception 'This account is referenced as an author in work history. Its historical records must be retained; no ownership was transferred.'; end if;
 -- Recipient must already have project access. Super admins have organization-wide access.
 for item in select id as project_id from public.projects where organization_id=target_organization and owner_id=departing_employee
 union select project_id from public.campaigns where organization_id=target_organization and owner_id=departing_employee
 union select project_id from public.tasks where organization_id=target_organization and assignee_id=departing_employee
 union select l.project_id from public.asset_project_links l join public.assets a on a.id=l.asset_id where a.organization_id=target_organization and a.owner_id=departing_employee
 union select c.project_id from public.asset_campaign_links l join public.assets a on a.id=l.asset_id join public.campaigns c on c.id=l.campaign_id where a.organization_id=target_organization and a.owner_id=departing_employee
 loop
  if receiver_role<>'org_admin' and not exists(select 1 from public.project_members where project_id=item.project_id and profile_id=recipient and history_access='full_history') then raise exception 'The selected employee needs full access to every affected project first. Choose yourself or grant project access before deleting.'; end if;
  if receiver_role='org_admin' then
   insert into public.project_members(organization_id,project_id,profile_id,role,history_access,can_edit,can_manage_members,can_approve_deliverables,can_manage_assets,can_comment)
   values(target_organization,item.project_id,recipient,'project_manager','full_history',true,true,true,true,true) on conflict(project_id,profile_id) do nothing;
  end if;
 end loop;
 -- No authenticated actor is impersonated: service-only transfer follows all checks above.
 perform set_config('request.jwt.claim.sub','',true);
 update public.projects set owner_id=recipient where organization_id=target_organization and owner_id=departing_employee; get diagnostics project_count=row_count;
 update public.campaigns set owner_id=recipient where organization_id=target_organization and owner_id=departing_employee; get diagnostics campaign_count=row_count;
 update public.assets set owner_id=recipient where organization_id=target_organization and owner_id=departing_employee; get diagnostics asset_count=row_count;
 update public.tasks set assignee_id=recipient where organization_id=target_organization and assignee_id=departing_employee; get diagnostics task_count=row_count;
 return jsonb_build_object('projects',project_count,'campaigns',campaign_count,'assets',asset_count,'tasks',task_count);
end; $$;
revoke all on function public.transfer_departing_employee_work(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.transfer_departing_employee_work(uuid,uuid,uuid,uuid) to service_role;
commit;
