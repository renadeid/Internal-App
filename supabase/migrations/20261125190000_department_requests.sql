begin;

-- Requests expose their own brief and approved result, never broader project access.
create table public.department_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 department_id uuid not null,
 requested_by uuid references public.profiles(id) on delete set null,
 title text not null check(length(btrim(title)) between 1 and 160),
 brief text not null check(length(btrim(brief)) between 1 and 6000),
 reference_url text check(reference_url is null or (length(reference_url)<=2000 and reference_url ~ '^https://[^[:space:]]+$')),
 priority public.task_priority not null default 'medium', due_on date,
 status text not null default 'submitted' check(status in ('submitted','accepted','declined','cancelled')),
 decision_note text not null default '' check(length(decision_note)<=2000),
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz, task_id uuid unique references public.tasks(id) on delete set null,
 created_at timestamptz not null default now(),
 foreign key(organization_id,department_id) references public.departments(organization_id,id)
);
create index department_requests_inbox on public.department_requests(organization_id,department_id,created_at desc);
create index department_requests_sender on public.department_requests(organization_id,requested_by,created_at desc);
alter table public.department_requests enable row level security;
revoke all on public.department_requests from anon,authenticated;

create function private.can_manage_department_request(org uuid,dept uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships o where o.organization_id=org and o.profile_id=auth.uid()
 and (o.role='org_admin' or (o.role='team_lead' and exists(select 1 from public.department_memberships d
 where d.organization_id=org and d.department_id=dept and d.profile_id=auth.uid() and d.role='manager'))));
$$;
revoke all on function private.can_manage_department_request(uuid,uuid) from public,anon,authenticated;

create function public.send_department_request(target_organization uuid,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare dept uuid:=(payload->>'departmentId')::uuid; request_id uuid;
begin
 if not exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id=auth.uid() and role in ('org_admin','team_lead','member'))
 then raise exception 'Request permission required' using errcode='42501';end if;
 if not exists(select 1 from public.departments where organization_id=target_organization and id=dept) then raise exception 'Department unavailable' using errcode='22023';end if;
 insert into public.department_requests(organization_id,department_id,requested_by,title,brief,reference_url,priority,due_on)
 values(target_organization,dept,auth.uid(),btrim(payload->>'title'),btrim(payload->>'brief'),nullif(btrim(payload->>'referenceUrl'),''),(payload->>'priority')::public.task_priority,nullif(payload->>'dueOn','')::date)
 returning id into request_id;
 return request_id;
end;$$;
revoke all on function public.send_department_request(uuid,jsonb) from public,anon;
grant execute on function public.send_department_request(uuid,jsonb) to authenticated;

create function public.decide_department_request(target_request uuid,decision text,feedback text default '',target_project uuid default null,target_assignee uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.department_requests%rowtype; task uuid;
begin
 select * into r from public.department_requests where id=target_request for update;
 if not found or not exists(select 1 from public.organization_memberships where organization_id=r.organization_id and profile_id=auth.uid())
 then raise exception 'Request unavailable' using errcode='42501';end if;
 if decision is null or decision not in ('accepted','declined','cancelled') or feedback is null or length(feedback)>2000 then raise exception 'Invalid decision' using errcode='22023';end if;
 if decision='cancelled' then
  if r.requested_by is distinct from auth.uid() then raise exception 'Only the sender can cancel' using errcode='42501';end if;
 elsif not private.can_manage_department_request(r.organization_id,r.department_id) then raise exception 'Department lead permission required' using errcode='42501';end if;
 if r.status<>'submitted' then raise exception 'This request has already been handled. Refresh the inbox.' using errcode='22023';end if;
 if decision='declined' and length(btrim(feedback))=0 then raise exception 'Explain why this request was declined.' using errcode='22023';end if;
 if decision='accepted' then
  perform 1 from public.projects p where p.id=target_project and p.organization_id=r.organization_id and p.archived_at is null
   and (p.lead_department_id=r.department_id or exists(select 1 from public.project_departments pd where pd.project_id=p.id and pd.department_id=r.department_id))
   and private.can_write_project(p.id) for share;
  if not found then raise exception 'Choose an active project for this department with full task access.' using errcode='42501';end if;
  if not exists(select 1 from public.project_members m join public.organization_memberships o on o.organization_id=m.organization_id and o.profile_id=m.profile_id
   where m.project_id=target_project and m.organization_id=r.organization_id and m.profile_id=target_assignee and m.role<>'viewer' and o.role<>'viewer'
   and (m.history_access='full_history' or (m.history_access='assigned_only' and m.can_update_assigned_status)))
   then raise exception 'Choose a project member with permission to submit work.' using errcode='22023';end if;
  insert into public.tasks(organization_id,project_id,title,description,status,priority,assignee_id,due_on)
  values(r.organization_id,target_project,r.title,r.brief||case when r.reference_url is null then '' else E'\n\nReference: '||r.reference_url end,'todo',r.priority,target_assignee,r.due_on) returning id into task;
 end if;
 update public.department_requests set status=decision,decision_note=btrim(feedback),reviewed_by=auth.uid(),reviewed_at=now(),task_id=task where id=r.id;
 return task;
end;$$;
revoke all on function public.decide_department_request(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.decide_department_request(uuid,text,text,uuid,uuid) to authenticated;

create function public.department_request_library(target_organization uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; org_role public.org_role;
begin
 select role into org_role from public.organization_memberships where organization_id=target_organization and profile_id=auth.uid();
 if not found then raise exception 'Workspace unavailable' using errcode='42501';end if;
 select jsonb_build_object('canCreate',org_role in ('org_admin','team_lead','member'),
 'departments',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'canManage',private.can_manage_department_request(d.organization_id,d.id)) order by d.name) from public.departments d where d.organization_id=target_organization),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(jsonb_build_object(
 'id',r.id,'title',r.title,'brief',r.brief,'referenceUrl',r.reference_url,'departmentId',r.department_id,'departmentName',d.name,
 'isMine',r.requested_by=auth.uid(),'requesterName',coalesce(a.full_name,'Former employee'),'priority',r.priority,'dueOn',r.due_on,
 'status',r.status,'decisionNote',r.decision_note,'reviewerName',b.full_name,'reviewedAt',r.reviewed_at,'createdAt',r.created_at,
 'canManage',private.can_manage_department_request(r.organization_id,r.department_id),
 'taskId',case when private.task_work_access(t.id,auth.uid(),'read') then t.id else null end,
 'taskStatus',t.status,'taskArchived',t.archived_at is not null or p.archived_at is not null,'assigneeName',c.full_name,
 'result',case when t.status='done' and s.id is not null and t.assignee_id=s.submitted_by then jsonb_build_object('id',s.id,'revision',s.revision,'note',s.note,'link',s.link_url,'fileName',s.file_name,'reviewedAt',s.reviewed_at) else null end
 ) order by r.created_at desc) from public.department_requests r join public.departments d on d.id=r.department_id
 left join public.profiles a on a.id=r.requested_by left join public.profiles b on b.id=r.reviewed_by
 left join public.tasks t on t.id=r.task_id left join public.projects p on p.id=t.project_id left join public.profiles c on c.id=t.assignee_id
 left join lateral(select ss.* from public.task_submissions ss where ss.task_id=t.id and ss.status='approved' order by ss.revision desc limit 1)s on true
 where r.organization_id=target_organization and (r.requested_by=auth.uid() or private.can_manage_department_request(r.organization_id,r.department_id))),'[]'::jsonb)) into result;
 return result;
end;$$;
revoke all on function public.department_request_library(uuid) from public,anon;
grant execute on function public.department_request_library(uuid) to authenticated;

create function public.department_request_result_file(target_request uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.department_requests%rowtype; s public.task_submissions%rowtype;
begin
 select * into r from public.department_requests where id=target_request;
 if not found or not exists(select 1 from public.organization_memberships where organization_id=r.organization_id and profile_id=auth.uid())
 or not (r.requested_by=auth.uid() or private.can_manage_department_request(r.organization_id,r.department_id)) then raise exception 'File unavailable' using errcode='42501';end if;
 select ss.* into s from public.task_submissions ss join public.tasks t on t.id=ss.task_id
 where t.id=r.task_id and t.status='done' and ss.status='approved' and ss.submitted_by=t.assignee_id order by ss.revision desc limit 1;
 if not found or s.file_name is null then raise exception 'File unavailable' using errcode='42501';end if;
 return jsonb_build_object('organizationId',s.organization_id,'taskId',s.task_id,'id',s.id,'fileName',s.file_name);
end;$$;
revoke all on function public.department_request_result_file(uuid) from public,anon;
grant execute on function public.department_request_result_file(uuid) to authenticated;
commit;
