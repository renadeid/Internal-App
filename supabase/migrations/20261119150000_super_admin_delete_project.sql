-- Permanent deletion is atomic and restricted to the organization's Super admin.
create function public.admin_delete_project(target_organization uuid, target_project uuid, confirmation_name text)
returns boolean language plpgsql security definer set search_path='' as $$
declare project_name text;
begin
 if not private.is_org_admin(target_organization) then
  raise exception 'Only Super admin can delete projects' using errcode='42501';
 end if;
 select name into project_name from public.projects
 where id=target_project and organization_id=target_organization for update;
 if not found then return false; end if;
 if confirmation_name is distinct from project_name then
  raise exception 'Enter the exact project name' using errcode='22023';
 end if;
 delete from public.notifications where organization_id=target_organization and activity_event_id in
 (select id from public.activity_events where organization_id=target_organization and project_id=target_project);
 delete from public.activity_events where organization_id=target_organization and project_id=target_project;
 delete from public.approval_requests where organization_id=target_organization and project_id=target_project;
 delete from public.deliverables where organization_id=target_organization and project_id=target_project;
 delete from public.tasks where organization_id=target_organization and project_id=target_project;
 delete from public.campaigns where organization_id=target_organization and project_id=target_project;
 delete from public.projects where organization_id=target_organization and id=target_project;
 return true;
end;
$$;
revoke all on function public.admin_delete_project(uuid,uuid,text) from public,anon;
grant execute on function public.admin_delete_project(uuid,uuid,text) to authenticated;
-- Also constrain any present or future direct DELETE policy.
create policy projects_super_admin_delete_only on public.projects as restrictive
for delete to authenticated using (private.is_org_admin(organization_id));
