begin;
alter table public.notifications
 add column department_request_id uuid references public.department_requests(id) on delete cascade,
 add column task_id uuid references public.tasks(id) on delete cascade,
 add column event_key text;
create unique index notification_request_event_once on public.notifications(recipient_id,event_key) where event_key is not null;

-- Preserve the existing activity notification guard, and protect the new routing fields.
create or replace function private.enforce_notification_update() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  if not private.operation_is_open('notification',new.activity_event_id)
   and not (new.department_request_id is not null and private.operation_is_open('request_notification',new.id))
  then raise exception 'notifications are created by the database' using errcode='42501';end if;
  return new;
 end if;
 if new.organization_id is distinct from old.organization_id or new.recipient_id is distinct from old.recipient_id
 or new.activity_event_id is distinct from old.activity_event_id or new.title is distinct from old.title
 or new.created_at is distinct from old.created_at or new.department_request_id is distinct from old.department_request_id
 or new.task_id is distinct from old.task_id or new.event_key is distinct from old.event_key
 then raise exception 'only read_at can change on a notification';end if;
 return new;
end;$$;

create function private.can_read_request_notification(request_id uuid,linked_task uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.department_requests r join public.organization_memberships o on o.organization_id=r.organization_id and o.profile_id=auth.uid()
 where r.id=request_id and (case when linked_task is not null then linked_task=r.task_id and private.task_work_access(linked_task,auth.uid(),'read')
 else r.requested_by=auth.uid() or private.can_manage_department_request(r.organization_id,r.department_id) end));
$$;
revoke all on function private.can_read_request_notification(uuid,uuid) from public,anon;
grant execute on function private.can_read_request_notification(uuid,uuid) to authenticated;
create policy notification_request_current_access on public.notifications as restrictive for select to authenticated
 using(department_request_id is null or private.can_read_request_notification(department_request_id,task_id));

create function private.emit_request_notification(request_id uuid,recipient uuid,event text,label text,linked_task uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.department_requests%rowtype; notification_id uuid:=gen_random_uuid();
begin
 select * into r from public.department_requests where id=request_id;
 if not found or recipient is null or not exists(select 1 from public.organization_memberships where organization_id=r.organization_id and profile_id=recipient) then return;end if;
 perform private.open_operation('request_notification',notification_id);
 insert into public.notifications(id,organization_id,recipient_id,department_request_id,task_id,event_key,title)
 values(notification_id,r.organization_id,recipient,r.id,linked_task,r.id::text||':'||event,label||': '||r.title)
 on conflict(recipient_id,event_key) where event_key is not null do nothing;
 perform private.close_operation('request_notification',notification_id);
end;$$;
revoke all on function private.emit_request_notification(uuid,uuid,text,text,uuid) from public,anon,authenticated;

create function private.notify_department_request() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; assignee uuid;
begin
 if tg_op='INSERT' then
  for recipient in select o.profile_id from public.organization_memberships o where o.organization_id=new.organization_id
   and o.profile_id is distinct from new.requested_by and (o.role='org_admin' or (o.role='team_lead' and exists(
    select 1 from public.department_memberships d where d.organization_id=new.organization_id and d.department_id=new.department_id and d.profile_id=o.profile_id and d.role='manager')))
  loop perform private.emit_request_notification(new.id,recipient,'submitted','New department request');end loop;
 elsif new.status is distinct from old.status then
  if new.status in ('accepted','declined') and new.requested_by is distinct from auth.uid() then
   perform private.emit_request_notification(new.id,new.requested_by,new.status,case when new.status='accepted' then 'Request accepted' else 'Request declined' end);
  end if;
  if new.status='accepted' then
   select assignee_id into assignee from public.tasks where id=new.task_id;
   if assignee is distinct from auth.uid() then perform private.emit_request_notification(new.id,assignee,'assigned','Task assigned from a department request',new.task_id);end if;
  end if;
 end if;
 return null;
end;$$;
revoke all on function private.notify_department_request() from public,anon,authenticated;
create trigger department_requests_notify after insert or update of status on public.department_requests for each row execute function private.notify_department_request();

create function private.notify_request_delivery() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.department_requests%rowtype;
begin
 if new.status='approved' and old.status is distinct from new.status then
  select * into r from public.department_requests where task_id=new.task_id and status='accepted';
  -- The assignee already receives the existing task approval notification.
  if found and r.requested_by is distinct from auth.uid() and r.requested_by is distinct from new.submitted_by then
   perform private.emit_request_notification(r.id,r.requested_by,'approved:'||new.id::text,'Your requested work is approved');
  end if;
 end if;
 return null;
end;$$;
revoke all on function private.notify_request_delivery() from public,anon,authenticated;
create trigger task_submission_request_delivery after update of status on public.task_submissions for each row execute function private.notify_request_delivery();
commit;
