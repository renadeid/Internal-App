begin;
create table public.knowledge_articles (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 160),
 summary text not null default '' check(char_length(summary)<=400),
 body text not null check(char_length(btrim(body)) between 1 and 30000),
 category text not null check(category in ('Getting started','Company policies','Department guides')),
 department_id uuid,
 status text not null default 'draft' check(status in ('draft','published','archived')),
 source_url text check(source_url is null or (char_length(source_url)<=2048 and source_url ~ '^https://[^[:space:]]+$')),
 created_by uuid references public.profiles(id) on delete set null,
 updated_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(organization_id,department_id) references public.departments(organization_id,id),
 check((category='Department guides' and department_id is not null) or (category<>'Department guides' and department_id is null))
);
create index knowledge_articles_organization_status on public.knowledge_articles(organization_id,status,updated_at desc);
alter table public.knowledge_articles enable row level security;
revoke all on public.knowledge_articles from public,anon,authenticated;
grant select,insert,update on public.knowledge_articles to authenticated;

create function private.can_manage_knowledge(target_organization uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships where organization_id=target_organization and profile_id=auth.uid() and role::text in ('org_admin','team_lead'));
$$;
revoke all on function private.can_manage_knowledge(uuid) from public,anon;
grant execute on function private.can_manage_knowledge(uuid) to authenticated;
create policy knowledge_read on public.knowledge_articles for select to authenticated using(private.is_org_member(organization_id) and (status='published' or private.can_manage_knowledge(organization_id)));
create policy knowledge_insert on public.knowledge_articles for insert to authenticated with check(private.can_manage_knowledge(organization_id));
create policy knowledge_update on public.knowledge_articles for update to authenticated using(private.can_manage_knowledge(organization_id)) with check(private.can_manage_knowledge(organization_id));

create function private.stamp_knowledge_article() returns trigger
language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  new.created_by:=auth.uid(); new.created_at:=now();
 else
  if new.organization_id is distinct from old.organization_id or new.id is distinct from old.id then raise exception 'Article workspace cannot change' using errcode='42501'; end if;
  new.created_by:=old.created_by; new.created_at:=old.created_at;
 end if;
 new.updated_by:=auth.uid(); new.updated_at:=now();
 return new;
end;
$$;
revoke all on function private.stamp_knowledge_article() from public,anon,authenticated;
create trigger stamp_knowledge_article before insert or update on public.knowledge_articles for each row execute function private.stamp_knowledge_article();
notify pgrst,'reload schema';
commit;
