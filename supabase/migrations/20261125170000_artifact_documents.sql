begin;
create table public.artifact_documents (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 160),
 file_name text not null check(char_length(file_name) between 1 and 180 and file_name ~* '\.(md|markdown|txt)$'),
 content text not null check(char_length(btrim(content))>0 and octet_length(content)<=524288),
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
create unique index artifact_documents_unique_name on public.artifact_documents(organization_id,lower(file_name));
create index artifact_documents_workspace on public.artifact_documents(organization_id,created_at desc);
alter table public.artifact_documents enable row level security;
revoke all on public.artifact_documents from public,anon,authenticated;
grant select,insert on public.artifact_documents to authenticated;
create policy artifact_documents_read on public.artifact_documents for select to authenticated using(private.is_org_member(organization_id));
create policy artifact_documents_upload on public.artifact_documents for insert to authenticated with check(exists(select 1 from public.organization_memberships where organization_id=artifact_documents.organization_id and profile_id=auth.uid() and role::text in ('org_admin','team_lead','member')));
create function private.stamp_artifact_document() returns trigger language plpgsql set search_path='' as $$
begin new.created_by:=auth.uid();new.created_at:=now();return new;end;
$$;
revoke all on function private.stamp_artifact_document() from public,anon,authenticated;
create trigger stamp_artifact_document before insert on public.artifact_documents for each row execute function private.stamp_artifact_document();
notify pgrst,'reload schema';
commit;
