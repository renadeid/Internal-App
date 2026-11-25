-- Explicit temporary fixtures: demo actors may have changed roles since the last run.
begin;
select set_config('request.jwt.claim.sub','13283bb9-bc79-4144-a4f9-0a4d97cd6314',true);
update public.organization_memberships set role='team_lead' where organization_id='5ec0a001-0000-4000-8000-000000000001' and profile_id='25d84194-b1f5-4524-aabb-13d04258b4f9';
insert into public.departments(id,organization_id,name,slug) values
 ('11110000-0000-4000-8000-000000000001','5ec0a001-0000-4000-8000-000000000001','Rollback requests department','rollback-requests-department'),
 ('11110000-0000-4000-8000-000000000002','5ec0a001-0000-4000-8000-000000000001','Rollback other department','rollback-other-department');
insert into public.department_memberships(organization_id,department_id,profile_id,role) values('5ec0a001-0000-4000-8000-000000000001','11110000-0000-4000-8000-000000000001','25d84194-b1f5-4524-aabb-13d04258b4f9','manager');
insert into public.project_departments(organization_id,project_id,department_id) values('5ec0a001-0000-4000-8000-000000000001','f4ac873d-a892-40b8-bf65-07395524e759','11110000-0000-4000-8000-000000000001');
insert into public.project_members(organization_id,project_id,profile_id,role,history_access) values('5ec0a001-0000-4000-8000-000000000001','f4ac873d-a892-40b8-bf65-07395524e759','25d84194-b1f5-4524-aabb-13d04258b4f9','project_member','full_history') on conflict(project_id,profile_id) do update set role='project_member',history_access='full_history';
set local role authenticated;
do $$
declare org uuid:='5ec0a001-0000-4000-8000-000000000001'; mine uuid; other uuid; task uuid;
begin
 perform set_config('request.jwt.claim.sub','8b27bd96-c64a-4844-82a1-5d16abfa8cb5',true);
 mine:=public.send_department_request(org,jsonb_build_object('departmentId','11110000-0000-4000-8000-000000000001','title','Lead test','brief','Expected result','priority','medium'));
 other:=public.send_department_request(org,jsonb_build_object('departmentId','11110000-0000-4000-8000-000000000002','title','Other dept test','brief','Expected result','priority','medium'));
 perform set_config('request.jwt.claim.sub','25d84194-b1f5-4524-aabb-13d04258b4f9',true);
 if not exists(select 1 from jsonb_array_elements(public.department_request_library(org)->'requests')x where x->>'id'=mine::text and (x->>'canManage')::boolean) then raise exception 'Department lead inbox failed';end if;
 if not exists(select 1 from public.notifications where department_request_id=mine) or exists(select 1 from public.notifications where department_request_id=other) then raise exception 'Department notification scope failed';end if;
 if exists(select 1 from jsonb_array_elements(public.department_request_library(org)->'requests')x where x->>'id'=other::text) then raise exception 'Lead read another department';end if;
 begin perform public.decide_department_request(other,'declined','No');raise exception 'Lead managed another department';exception when insufficient_privilege then null;end;
 task:=public.decide_department_request(mine,'accepted','Assigned by department lead','f4ac873d-a892-40b8-bf65-07395524e759','f40a3a0b-cf06-4a65-b6c8-b55c0e695618');
 if task is null then raise exception 'Department lead did not create a task';end if;
 perform set_config('request.jwt.claim.sub','55d460a7-c840-4464-91c7-ac1e2db03fc3',true);
 begin perform public.send_department_request(org,jsonb_build_object('departmentId','11110000-0000-4000-8000-000000000001','title','Denied admin','brief','Result','priority','medium'));raise exception 'Admin sent request';exception when insufficient_privilege then null;end;
 begin perform public.decide_department_request(other,'declined','No');raise exception 'Admin managed request';exception when insufficient_privilege then null;end;
end;$$;
reset role;
select 'PASS: department lead acceptance, department isolation and read-only Admin role' as result;
rollback;
