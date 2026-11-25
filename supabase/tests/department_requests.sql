-- Existing demo actors only. Every request, task, submission and permission change is rolled back.
begin;
select set_config('request.jwt.claim.sub','13283bb9-bc79-4144-a4f9-0a4d97cd6314',true);
select set_config('test.request_org','5ec0a001-0000-4000-8000-000000000001',true);
select set_config('test.request_dept','2529044e-c32c-442f-8d92-56580b7d01ef',true);
set local role authenticated;
do $$
declare org uuid:=current_setting('test.request_org')::uuid; dept uuid:=current_setting('test.request_dept')::uuid; r uuid; t uuid; items jsonb;
begin
 perform set_config('request.jwt.claim.sub','8b27bd96-c64a-4844-82a1-5d16abfa8cb5',true);
 r:=public.send_department_request(org,jsonb_build_object('departmentId',dept,'title','Rollback request test','brief','Expected result','priority','high','dueOn','2026-12-01','referenceUrl','https://example.com/brief'));
 perform set_config('test.request_id',r::text,true);
 items:=public.department_request_library(org);
 if exists(select 1 from public.notifications where department_request_id=r) then raise exception 'Sender received own submission notification';end if;
 if not exists(select 1 from jsonb_array_elements(items->'requests') x where x->>'id'=r::text and (x->>'isMine')::boolean) then raise exception 'Sender cannot read own request';end if;
 begin perform public.decide_department_request(r,'accepted','','f4ac873d-a892-40b8-bf65-07395524e759','f40a3a0b-cf06-4a65-b6c8-b55c0e695618');raise exception 'Member accepted request';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','f40a3a0b-cf06-4a65-b6c8-b55c0e695618',true);
 if exists(select 1 from jsonb_array_elements(public.department_request_library(org)->'requests')x where x->>'id'=r::text) then raise exception 'Unrelated member read request';end if;
 begin perform public.decide_department_request(r,'cancelled');raise exception 'Other member cancelled request';exception when insufficient_privilege then null;end;
 begin perform public.department_request_result_file(r);raise exception 'Other member read result file';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','13283bb9-bc79-4144-a4f9-0a4d97cd6314',true);
 if not exists(select 1 from public.notifications where department_request_id=r and event_key=r::text||':submitted') then raise exception 'Super admin did not receive request notification';end if;
 begin perform public.decide_department_request(r,'declined','');raise exception 'Decline accepted without reason';exception when invalid_parameter_value then null;end;
 begin perform public.decide_department_request(r,'accepted','','f4ac873d-a892-40b8-bf65-07395524e759','8b27bd96-c64a-4844-82a1-5d16abfa8cb5');raise exception 'Non-project member assigned';exception when invalid_parameter_value then null;end;
 t:=public.decide_department_request(r,'accepted','Scope confirmed','f4ac873d-a892-40b8-bf65-07395524e759','f40a3a0b-cf06-4a65-b6c8-b55c0e695618');
 perform set_config('test.request_task',t::text,true);
 begin perform public.decide_department_request(r,'accepted','','f4ac873d-a892-40b8-bf65-07395524e759','f40a3a0b-cf06-4a65-b6c8-b55c0e695618');raise exception 'Duplicate task created';exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claim.sub','8b27bd96-c64a-4844-82a1-5d16abfa8cb5',true);
 select x into items from jsonb_array_elements(public.department_request_library(org)->'requests')x where x->>'id'=r::text;
 if not exists(select 1 from public.notifications where department_request_id=r and event_key=r::text||':accepted') then raise exception 'Sender did not receive decision notification';end if;
 if items->>'taskStatus'<>'todo' or items->>'taskId' is not null or items->'result'<>'null'::jsonb then raise exception 'Sender progress or privacy failed';end if;
 if exists(select 1 from public.tasks where id=t) then raise exception 'Request granted project task access';end if;
 begin perform public.department_request_library('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');raise exception 'Cross-tenant read accepted';exception when insufficient_privilege then null;end;
 begin perform public.department_request_result_file(r);raise exception 'Unapproved result available';exception when insufficient_privilege then null;end;
 -- Separate request cancellation and decline paths.
 r:=public.send_department_request(org,jsonb_build_object('departmentId',dept,'title','Cancel test','brief','Result','priority','medium'));
 perform public.decide_department_request(r,'cancelled');
 r:=public.send_department_request(org,jsonb_build_object('departmentId',dept,'title','Decline test','brief','Result','priority','medium'));
 perform set_config('request.jwt.claim.sub','13283bb9-bc79-4144-a4f9-0a4d97cd6314',true);
 perform public.decide_department_request(r,'declined','Out of scope');
end;$$;
reset role;
-- Service-only submission registration, followed by the normal independent review RPC.
select set_config('request.jwt.claim.sub','f40a3a0b-cf06-4a65-b6c8-b55c0e695618',true);
select set_config('test.request_submission',public.register_task_submission('f40a3a0b-cf06-4a65-b6c8-b55c0e695618',jsonb_build_object('id',gen_random_uuid(),'organizationId',current_setting('test.request_org'),'taskId',current_setting('test.request_task'),'note','Approved final outcome','link','https://example.com/final','fileName','result.txt','mime','text/plain','size',10))::text,true);
set local role authenticated;
do $$
declare r uuid:=current_setting('test.request_id')::uuid; org uuid:=current_setting('test.request_org')::uuid; item jsonb;
begin
 perform set_config('request.jwt.claim.sub','8b27bd96-c64a-4844-82a1-5d16abfa8cb5',true);
 select x into item from jsonb_array_elements(public.department_request_library(org)->'requests')x where x->>'id'=r::text;
 if exists(select 1 from public.notifications where department_request_id=r and event_key like '%:approved:%') then raise exception 'Approval notification sent too early';end if;
 if item->>'taskStatus'<>'in_review' or item->'result'<>'null'::jsonb then raise exception 'Pending submission leaked';end if;
 perform set_config('request.jwt.claim.sub','13283bb9-bc79-4144-a4f9-0a4d97cd6314',true);
 perform public.review_task_submission(current_setting('test.request_submission')::uuid,'approved','Meets the brief');
 perform set_config('request.jwt.claim.sub','8b27bd96-c64a-4844-82a1-5d16abfa8cb5',true);
 select x into item from jsonb_array_elements(public.department_request_library(org)->'requests')x where x->>'id'=r::text;
 if item->>'taskStatus'<>'done' or item->'result'->>'note'<>'Approved final outcome' or item->>'taskId' is not null then raise exception 'Approved result or task isolation failed';end if;
 if not exists(select 1 from public.notifications where department_request_id=r and event_key=r::text||':approved:'||current_setting('test.request_submission')) then raise exception 'Sender did not receive final delivery notification';end if;
 if public.department_request_result_file(r)->>'fileName'<>'result.txt' then raise exception 'Approved download denied';end if;
 -- Unrelated and foreign users still cannot read the final result.
 perform set_config('request.jwt.claim.sub','f40a3a0b-cf06-4a65-b6c8-b55c0e695618',true);
 if not exists(select 1 from public.notifications where department_request_id=r and task_id=current_setting('test.request_task')::uuid and event_key=r::text||':assigned') then raise exception 'Assignee did not receive task notification';end if;
 if exists(select 1 from public.notifications where department_request_id=r and task_id is null) then raise exception 'Assignee saw private request notifications';end if;
 begin perform public.department_request_result_file(r);raise exception 'Unrelated sender downloaded final';exception when insufficient_privilege then null;end;
end;$$;
reset role;
select 'PASS: request lifecycle, duplicate prevention, tenant isolation, pending-result privacy and approved-only downloads' as result;
rollback;
