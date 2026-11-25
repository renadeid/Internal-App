begin;
alter table public.department_requests add column archived_at timestamptz,add column archived_by uuid references public.profiles(id) on delete set null;
create function public.set_department_request_archived(target_organization uuid,target_request uuid,archived boolean) returns void
language plpgsql security definer set search_path='' as $$
declare r public.department_requests%rowtype;
begin
 select * into r from public.department_requests where id=target_request and organization_id=target_organization for update;
 if not found or not private.can_manage_department_request(r.organization_id,r.department_id) then raise exception 'Department lead or Super admin permission required.' using errcode='42501';end if;
 if archived is null then raise exception 'Choose archive or restore.' using errcode='22023';end if;
 if (r.archived_at is not null) is distinct from archived then
  update public.department_requests set archived_at=case when archived then now() else null end,archived_by=case when archived then auth.uid() else null end where id=r.id;
 end if;
end;$$;
revoke all on function public.set_department_request_archived(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_department_request_archived(uuid,uuid,boolean) to authenticated;

alter function public.department_request_library(uuid) rename to department_request_library_base;
revoke all on function public.department_request_library_base(uuid) from public,anon,authenticated;
create function public.department_request_library(target_organization uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.department_request_library_base(target_organization);
 return jsonb_set(result,'{requests}',coalesce((select jsonb_agg(item||jsonb_build_object('archivedAt',r.archived_at) order by item->>'createdAt' desc)
 from jsonb_array_elements(result->'requests')item join public.department_requests r on r.id=(item->>'id')::uuid),'[]'::jsonb));
end;$$;
revoke all on function public.department_request_library(uuid) from public,anon;
grant execute on function public.department_request_library(uuid) to authenticated;

create function private.guard_archived_department_request() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.archived_at is not null and new.status is distinct from old.status then raise exception 'Restore this request before accepting, declining or cancelling it.' using errcode='22023';end if;
 return new;
end;$$;
revoke all on function private.guard_archived_department_request() from public,anon,authenticated;
create trigger department_requests_archived_guard before update of status on public.department_requests for each row execute function private.guard_archived_department_request();
commit;
