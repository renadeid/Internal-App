begin;
-- Work events use targeted notifications so assigned-only members do not learn other task titles.
create or replace function private.fanout_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.project_id is null or new.verb in ('task_submitted','task_approved','task_changes_requested') then return null;end if;
 perform private.open_operation('notification',new.id);
 insert into public.notifications(organization_id,recipient_id,activity_event_id,title)
 select new.organization_id,m.profile_id,new.id,new.summary from public.project_members m where m.project_id=new.project_id and m.profile_id is distinct from new.actor_id;
 perform private.close_operation('notification',new.id);return null;
end;$$;

create table public.task_submissions (
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 task_id uuid not null references public.tasks(id) on delete cascade,
 submitted_by uuid references public.profiles(id) on delete set null,
 revision integer not null check(revision>0), note text not null default '' check(length(note)<=4000),
 link_url text check(link_url is null or (length(link_url)<=2000 and link_url ~ '^https://[^[:space:]]+$')),
 file_name text, file_mime text, file_size integer check(file_size between 1 and 20971520),
 status text not null default 'pending' check(status in ('pending','approved','changes_requested')),
 review_note text not null default '' check(length(review_note)<=4000),
 reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz,
 created_at timestamptz not null default now(), unique(task_id,revision),
 check(length(btrim(note))>0 or link_url is not null or file_name is not null),
 check((file_name is null and file_mime is null and file_size is null) or (file_name is not null and file_mime is not null and file_size is not null))
);
create unique index task_submission_one_pending on public.task_submissions(task_id) where status='pending';
alter table public.task_submissions enable row level security;
revoke all on public.task_submissions from anon,authenticated;

create function private.task_work_access(target_task uuid,actor uuid,access_mode text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tasks t join public.projects p on p.id=t.project_id and p.organization_id=t.organization_id
 join public.organization_memberships o on o.organization_id=t.organization_id and o.profile_id=actor
 left join public.project_members m on m.project_id=p.id and m.organization_id=t.organization_id and m.profile_id=actor
 where t.id=target_task and case access_mode
 when 'read' then o.role in ('org_admin','admin') or m.history_access='full_history' or (m.history_access='assigned_only' and t.assignee_id=actor)
 when 'history' then o.role in ('org_admin','admin') or m.history_access='full_history'
 when 'submit' then t.archived_at is null and p.archived_at is null and t.assignee_id=actor and o.role<>'viewer'
 and (o.role in ('org_admin','admin') or (m.role<>'viewer' and (m.history_access='full_history' or (m.history_access='assigned_only' and m.can_update_assigned_status))))
 when 'review' then t.archived_at is null and p.archived_at is null and o.role<>'viewer'
 and (o.role in ('org_admin','admin') or (m.role<>'viewer' and m.history_access='full_history' and (o.role='team_lead' or m.can_approve_deliverables)))
 else false end);
$$;
revoke all on function private.task_work_access(uuid,uuid,text) from public,anon,authenticated;

create function public.task_work_panel(target_task uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.task_work_access(target_task,auth.uid(),'read') then raise exception 'Task unavailable' using errcode='42501';end if;
 select jsonb_build_object('canSubmit',private.task_work_access(t.id,auth.uid(),'submit') and t.status<>'done',
 'canReview',private.task_work_access(t.id,auth.uid(),'review') and t.assignee_id is distinct from auth.uid(),
 'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'revision',s.revision,'note',s.note,'link',s.link_url,
 'fileName',s.file_name,'size',s.file_size,'status',s.status,'reviewNote',s.review_note,'createdAt',s.created_at,'reviewedAt',s.reviewed_at,
 'author',coalesce(a.full_name,'Former employee'),'reviewer',coalesce(r.full_name,'Former employee')) order by s.revision desc)
 from public.task_submissions s left join public.profiles a on a.id=s.submitted_by left join public.profiles r on r.id=s.reviewed_by
 where s.task_id=t.id and (private.task_work_access(t.id,auth.uid(),'history') or s.submitted_by=auth.uid())),'[]'::jsonb)) into result from public.tasks t where t.id=target_task;
 return result;
end;$$;
revoke all on function public.task_work_panel(uuid) from public,anon;
grant execute on function public.task_work_panel(uuid) to authenticated;

create function public.register_task_submission(actor uuid,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.tasks%rowtype; submission_id uuid:=(payload->>'id')::uuid; revision_number integer; event_id uuid;
begin
 select * into t from public.tasks where id=(payload->>'taskId')::uuid for update;
 if not found or t.organization_id<>(payload->>'organizationId')::uuid or not private.task_work_access(t.id,actor,'submit') then raise exception 'Task submission permission required' using errcode='42501';end if;
 if exists(select 1 from public.task_submissions where id=submission_id and task_id=t.id and submitted_by=actor) then return submission_id;end if;
 if t.status='done' or exists(select 1 from public.task_submissions where task_id=t.id and status='pending') then raise exception 'A submission is already awaiting review, or this task is complete.' using errcode='22023';end if;
 select coalesce(max(revision),0)+1 into revision_number from public.task_submissions where task_id=t.id;
 insert into public.task_submissions(id,organization_id,task_id,submitted_by,revision,note,link_url,file_name,file_mime,file_size)
 values(submission_id,t.organization_id,t.id,actor,revision_number,coalesce(payload->>'note',''),nullif(payload->>'link',''),payload->>'fileName',payload->>'mime',(payload->>'size')::integer);
 perform private.open_operation('submit_task_work',t.id);
 update public.tasks set status='in_review' where id=t.id;
 event_id:=gen_random_uuid();
 perform private.open_operation('activity',event_id);
 insert into public.activity_events(id,organization_id,actor_id,verb,summary,project_id,task_id)
 values(event_id,t.organization_id,actor,'task_submitted','Work submitted for review: '||t.title,t.project_id,t.id) returning id into event_id;
 perform private.close_operation('activity',event_id);
 perform private.open_operation('notification',event_id);
 insert into public.notifications(organization_id,recipient_id,activity_event_id,title)
 select t.organization_id,o.profile_id,event_id,'Ready for review: '||t.title from public.organization_memberships o
 where o.organization_id=t.organization_id and o.profile_id<>actor and private.task_work_access(t.id,o.profile_id,'review');
 perform private.close_operation('notification',event_id);
 return submission_id;
end;$$;
revoke all on function public.register_task_submission(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.register_task_submission(uuid,jsonb) to service_role;

create function public.review_task_submission(target_submission uuid,decision text,feedback text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.task_submissions%rowtype; t public.tasks%rowtype; event_id uuid;
begin
 if decision is null or decision not in ('approved','changes_requested') or feedback is null or length(feedback)>4000 or (decision='changes_requested' and length(btrim(feedback))=0) then raise exception 'Add a comment explaining the requested changes.' using errcode='22023';end if;
 -- All workflow mutations lock the task first to serialize submissions and reviews.
 select t0.* into t from public.tasks t0 join public.task_submissions s0 on s0.task_id=t0.id where s0.id=target_submission for update of t0;
 select * into s from public.task_submissions where id=target_submission for update;
 if not found or not private.task_work_access(t.id,auth.uid(),'review') or s.submitted_by=auth.uid() or t.assignee_id is distinct from s.submitted_by then raise exception 'A different authorized reviewer is required.' using errcode='42501';end if;
 if s.status<>'pending' or t.status<>'in_review' then raise exception 'This submission has already been reviewed.' using errcode='22023';end if;
 update public.task_submissions set status=decision,review_note=btrim(feedback),reviewed_by=auth.uid(),reviewed_at=now() where id=s.id;
 perform private.open_operation('review_task_work',t.id);
 update public.tasks set status=case when decision='approved' then 'done'::public.task_status else 'in_progress'::public.task_status end where id=t.id;
 event_id:=gen_random_uuid();
 perform private.open_operation('activity',event_id);
 insert into public.activity_events(id,organization_id,actor_id,verb,summary,project_id,task_id)
 values(event_id,t.organization_id,auth.uid(),case when decision='approved' then 'task_approved' else 'task_changes_requested' end,
 case when decision='approved' then 'Work approved: ' else 'Changes requested: ' end||t.title,t.project_id,t.id) returning id into event_id;
 perform private.close_operation('activity',event_id);
 perform private.open_operation('notification',event_id);
 insert into public.notifications(organization_id,recipient_id,activity_event_id,title)
 select t.organization_id,s.submitted_by,event_id,case when decision='approved' then 'Approved: ' else 'Changes requested: ' end||t.title where s.submitted_by is not null;
 perform private.close_operation('notification',event_id);
end;$$;
revoke all on function public.review_task_submission(uuid,text,text) from public,anon;
grant execute on function public.review_task_submission(uuid,text,text) to authenticated;

create function private.guard_task_workflow() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.status is distinct from old.status then
  if new.status='done' and not private.operation_is_open('review_task_work',new.id) then raise exception 'Complete this task by approving a submission.' using errcode='23514';end if;
  if new.status='in_review' and not private.operation_is_open('submit_task_work',new.id) then raise exception 'Submit work to send this task for review.' using errcode='23514';end if;
  if tg_op='UPDATE' and old.status='in_review' and exists(select 1 from public.task_submissions where task_id=new.id and status='pending') and not private.operation_is_open('review_task_work',new.id) then raise exception 'Review the pending submission first.' using errcode='23514';end if;
 end if;
 if tg_op='UPDATE' and new.assignee_id is distinct from old.assignee_id and exists(select 1 from public.task_submissions where task_id=new.id and status='pending') then raise exception 'Review the pending submission before reassigning.' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function private.guard_task_workflow() from public,anon,authenticated;
create trigger task_workflow_guard before insert or update on public.tasks for each row execute function private.guard_task_workflow();

create function public.task_submission_file(target_submission uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.task_submissions%rowtype;
begin
 select * into s from public.task_submissions where id=target_submission;
 if not found or s.file_name is null or not private.task_work_access(s.task_id,auth.uid(),'read')
 or not (private.task_work_access(s.task_id,auth.uid(),'history') or s.submitted_by=auth.uid()) then raise exception 'File unavailable' using errcode='42501';end if;
 return jsonb_build_object('organizationId',s.organization_id,'taskId',s.task_id,'id',s.id,'fileName',s.file_name,'mime',s.file_mime,'size',s.file_size);
end;$$;
revoke all on function public.task_submission_file(uuid) from public,anon;
grant execute on function public.task_submission_file(uuid) to authenticated;
commit;
