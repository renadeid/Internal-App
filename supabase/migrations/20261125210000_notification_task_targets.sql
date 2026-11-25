begin;
-- Resolve existing task workflow notifications without exposing their activity feed.
create function public.notification_task_targets(target_organization uuid)
returns table(notification_id uuid,task_id uuid)
language sql stable security definer set search_path='' as $$
 select n.id,e.task_id from public.notifications n
 join public.activity_events e on e.id=n.activity_event_id and e.organization_id=n.organization_id
 join public.organization_memberships m on m.organization_id=n.organization_id and m.profile_id=auth.uid()
 where n.organization_id=target_organization and n.recipient_id=auth.uid()
 and n.department_request_id is null and n.task_id is null
 and e.verb in ('task_submitted','task_approved','task_changes_requested')
 and e.task_id is not null and private.task_work_access(e.task_id,auth.uid(),'read');
$$;
revoke all on function public.notification_task_targets(uuid) from public,anon;
grant execute on function public.notification_task_targets(uuid) to authenticated;
commit;
