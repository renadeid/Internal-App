-- Public links are opt-in, read-only snapshots. No anonymous table access.
create table public.viewer_links (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 resource_id text not null,
 kind text not null check(kind in ('project','asset')),
 token text not null unique check(token ~ '^[a-f0-9]{64}$'),
 snapshot jsonb not null,
 created_by uuid not null references public.profiles(id),
 expires_at timestamptz not null default (now()+interval '7 days'),
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.viewer_links enable row level security;
revoke all on public.viewer_links from public,anon,authenticated;
grant select,update(revoked_at) on public.viewer_links to authenticated;
create policy viewer_links_manage on public.viewer_links for all to authenticated
using(private.is_org_admin(organization_id)) with check(private.is_org_admin(organization_id));

create function public.create_viewer_link(target_organization uuid, target_resource text, resource_kind text, link_token text, asset_snapshot jsonb default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare content jsonb; result uuid;
begin
 if not private.is_org_admin(target_organization) then raise exception 'Super admin required' using errcode='42501'; end if;
 if resource_kind='project' then
  select jsonb_build_object('title',p.name,'description',p.description,'status',p.status,'due',p.due_on,
   'tasks',coalesce((select jsonb_agg(jsonb_build_object('title',t.title,'description',t.description,'status',t.status,'due',t.due_on) order by t.created_at)
    from public.tasks t where t.project_id=p.id and t.organization_id=p.organization_id and t.archived_at is null),'[]'::jsonb))
  into content from public.projects p where p.id::text=target_resource and p.organization_id=target_organization and p.archived_at is null;
  if content is null then raise exception 'Project unavailable' using errcode='22023'; end if;
 elsif resource_kind='asset' then
  -- The current Assets Library stores records in the browser. Publish only the
  -- explicit fields previewed by the Super admin; never copy arbitrary JSON.
  if coalesce(length(btrim(asset_snapshot->>'title')),0)=0 or length(asset_snapshot::text)>20000 then raise exception 'Invalid asset' using errcode='22023'; end if;
  content := jsonb_build_object('title',asset_snapshot->>'title','description',asset_snapshot->>'description','url',asset_snapshot->>'url','type',asset_snapshot->>'type');
 else raise exception 'Invalid resource kind' using errcode='22023';
 end if;
 insert into public.viewer_links(organization_id,resource_id,kind,token,snapshot,created_by)
 values(target_organization,target_resource,resource_kind,link_token,content,auth.uid()) returning id into result;
 return result;
end;
$$;
revoke all on function public.create_viewer_link(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.create_viewer_link(uuid,text,text,text,jsonb) to authenticated;

create function public.read_viewer_link(link_token text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('kind',l.kind,'content',l.snapshot,'expires',l.expires_at)
 from public.viewer_links l where l.token=link_token and l.revoked_at is null and l.expires_at>now()
 and (l.kind<>'project' or exists(select 1 from public.projects p where p.id::text=l.resource_id and p.organization_id=l.organization_id and p.archived_at is null));
$$;
revoke all on function public.read_viewer_link(text) from public;
grant execute on function public.read_viewer_link(text) to anon,authenticated;

create function public.manage_viewer_links(target_organization uuid,target_resource text,resource_kind text,revoke_id uuid default null)
returns table(id uuid,created_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_org_admin(target_organization) then raise exception 'Super admin required' using errcode='42501'; end if;
 if revoke_id is not null then update public.viewer_links l set revoked_at=now()
 where l.id=revoke_id and l.organization_id=target_organization and l.resource_id=target_resource and l.kind=resource_kind; end if;
 return query select l.id,l.created_at,l.expires_at from public.viewer_links l where l.organization_id=target_organization
 and l.resource_id=target_resource and l.kind=resource_kind and l.revoked_at is null and l.expires_at>now() order by l.created_at desc;
end;
$$;
revoke all on function public.manage_viewer_links(uuid,text,text,uuid) from public,anon;
grant execute on function public.manage_viewer_links(uuid,text,text,uuid) to authenticated;
