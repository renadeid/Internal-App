-- Company Hub schema. Not applied to the remote project in this phase.
-- Multi-tenant from the first migration. Northline is one row, not a special case.
-- Authenticated users archive rows. They are not granted DELETE on work records.
-- Hard deletes of campaigns, tasks, and deliverables are restricted so work is not cascaded away.
-- Privileged writes consult private.operation_guard. A session setting is not an authorization check.

create schema if not exists private;

revoke all on schema private from public;

create type public.org_role as enum ('org_admin', 'member', 'viewer');
create type public.department_role as enum ('manager', 'member');
create type public.project_role as enum ('project_manager', 'project_member', 'viewer');
create type public.project_status as enum ('planning', 'in_progress', 'in_review', 'on_hold');
create type public.campaign_type as enum ('social_media', 'email', 'paid_ads', 'content', 'event', 'other');
create type public.campaign_status as enum ('planning', 'active', 'on_hold', 'completed');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_status as enum ('todo', 'in_progress', 'in_review', 'done');
create type public.deliverable_type as enum ('design', 'video', 'copy', 'document', 'presentation', 'other');
create type public.deliverable_status as enum ('draft', 'in_progress', 'submitted', 'changes_requested', 'approved');
create type public.approval_action as enum ('submit', 'start', 'approve', 'request_changes');
create type public.asset_type as enum ('image', 'video', 'document', 'presentation', 'design', 'external_link', 'other');
create type public.asset_visibility as enum ('company', 'project_members', 'restricted');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  constraint organizations_name_check check (char_length(btrim(name)) > 0),
  constraint organizations_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint organizations_slug_key unique (slug)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  constraint departments_name_check check (char_length(btrim(name)) > 0),
  constraint departments_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint departments_org_slug_key unique (organization_id, slug),
  constraint departments_org_id_key unique (organization_id, id)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  job_title text,
  avatar_color text,
  initials text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_check check (char_length(btrim(email)) > 0)
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  constraint organization_memberships_org_profile_key unique (organization_id, profile_id)
);

create table public.department_memberships (
  organization_id uuid not null,
  department_id uuid not null,
  profile_id uuid not null,
  role public.department_role not null,
  created_at timestamptz not null default now(),
  primary key (department_id, profile_id),
  constraint department_memberships_department_fkey
    foreign key (organization_id, department_id)
    references public.departments (organization_id, id)
    on delete cascade,
  constraint department_memberships_member_fkey
    foreign key (organization_id, profile_id)
    references public.organization_memberships (organization_id, profile_id)
    on delete cascade
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  lead_department_id uuid not null,
  status public.project_status not null default 'planning',
  owner_id uuid not null,
  starts_on date,
  due_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_check check (char_length(btrim(name)) > 0),
  constraint projects_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint projects_dates_check check (starts_on is null or due_on is null or due_on >= starts_on),
  constraint projects_org_slug_key unique (organization_id, slug),
  constraint projects_org_id_key unique (organization_id, id),
  constraint projects_lead_department_fkey
    foreign key (organization_id, lead_department_id)
    references public.departments (organization_id, id)
    on delete restrict,
  constraint projects_owner_fkey
    foreign key (organization_id, owner_id)
    references public.organization_memberships (organization_id, profile_id)
    on delete restrict
);

create table public.project_departments (
  project_id uuid not null,
  department_id uuid not null,
  organization_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (project_id, department_id),
  constraint project_departments_project_fkey
    foreign key (organization_id, project_id)
    references public.projects (organization_id, id)
    on delete cascade,
  constraint project_departments_department_fkey
    foreign key (organization_id, department_id)
    references public.departments (organization_id, id)
    on delete restrict
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  profile_id uuid not null,
  role public.project_role not null,
  can_edit boolean not null default false,
  can_manage_members boolean not null default false,
  can_approve_deliverables boolean not null default false,
  can_manage_assets boolean not null default false,
  can_comment boolean not null default true,
  created_at timestamptz not null default now(),
  constraint project_members_project_profile_key unique (project_id, profile_id),
  constraint project_members_project_fkey
    foreign key (organization_id, project_id)
    references public.projects (organization_id, id)
    on delete cascade,
  constraint project_members_member_fkey
    foreign key (organization_id, profile_id)
    references public.organization_memberships (organization_id, profile_id)
    on delete cascade
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  slug text not null,
  name text not null,
  description text not null default '',
  goals text not null default '',
  owner_id uuid not null,
  type public.campaign_type not null,
  status public.campaign_status not null default 'planning',
  starts_on date not null,
  ends_on date not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_name_check check (char_length(btrim(name)) > 0),
  constraint campaigns_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint campaigns_dates_check check (ends_on >= starts_on),
  constraint campaigns_org_slug_key unique (organization_id, slug),
  constraint campaigns_org_id_key unique (organization_id, id),
  constraint campaigns_identity_key unique (id, project_id, organization_id),
  constraint campaigns_project_fkey
    foreign key (organization_id, project_id)
    references public.projects (organization_id, id)
    on delete restrict,
  constraint campaigns_owner_fkey
    foreign key (organization_id, owner_id)
    references public.organization_memberships (organization_id, profile_id)
    on delete restrict
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  title text not null,
  description text not null default '',
  assignee_id uuid references public.profiles (id) on delete set null,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'todo',
  due_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_check check (char_length(btrim(title)) > 0),
  constraint tasks_project_fkey
    foreign key (organization_id, project_id)
    references public.projects (organization_id, id)
    on delete restrict
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  type public.asset_type not null,
  external_url text,
  tags text[] not null default '{}',
  owner_id uuid not null,
  visibility public.asset_visibility not null default 'project_members',
  collection text not null default 'General',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('simple', name || ' ' || description)
  ) stored,
  constraint assets_name_check check (char_length(btrim(name)) > 0),
  constraint assets_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint assets_collection_check check (char_length(btrim(collection)) > 0),
  constraint assets_external_url_check check (
    external_url is null or external_url ~* '^https?://[^[:space:]]+$'
  ),
  constraint assets_external_link_check check (
    type <> 'external_link' or external_url is not null
  ),
  constraint assets_org_slug_key unique (organization_id, slug),
  constraint assets_org_id_key unique (organization_id, id),
  constraint assets_owner_fkey
    foreign key (organization_id, owner_id)
    references public.organization_memberships (organization_id, profile_id)
    on delete restrict
);

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  campaign_id uuid not null,
  title text not null,
  type public.deliverable_type not null,
  creator_id uuid not null references public.profiles (id) on delete restrict,
  status public.deliverable_status not null default 'draft',
  due_on date,
  asset_id uuid references public.assets (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deliverables_title_check check (char_length(btrim(title)) > 0),
  constraint deliverables_campaign_fkey
    foreign key (campaign_id, project_id, organization_id)
    references public.campaigns (id, project_id, organization_id)
    on delete restrict,
  constraint deliverables_project_fkey
    foreign key (organization_id, project_id)
    references public.projects (organization_id, id)
    on delete restrict
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  deliverable_id uuid not null references public.deliverables (id) on delete cascade,
  project_id uuid not null,
  action public.approval_action not null,
  from_status public.deliverable_status not null,
  to_status public.deliverable_status not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint approval_requests_project_fkey
    foreign key (organization_id, project_id)
    references public.projects (organization_id, id)
    on delete restrict
);

create table public.asset_access (
  asset_id uuid not null,
  profile_id uuid not null,
  organization_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (asset_id, profile_id),
  constraint asset_access_asset_fkey
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id)
    on delete cascade,
  constraint asset_access_member_fkey
    foreign key (organization_id, profile_id)
    references public.organization_memberships (organization_id, profile_id)
    on delete cascade
);

create table public.asset_project_links (
  asset_id uuid not null,
  project_id uuid not null,
  organization_id uuid not null,
  linked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (asset_id, project_id),
  constraint asset_project_links_asset_fkey
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id)
    on delete cascade,
  constraint asset_project_links_project_fkey
    foreign key (organization_id, project_id)
    references public.projects (organization_id, id)
    on delete cascade
);

create table public.asset_campaign_links (
  asset_id uuid not null,
  campaign_id uuid not null,
  organization_id uuid not null,
  linked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (asset_id, campaign_id),
  constraint asset_campaign_links_asset_fkey
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id)
    on delete cascade,
  constraint asset_campaign_links_campaign_fkey
    foreign key (organization_id, campaign_id)
    references public.campaigns (organization_id, id)
    on delete cascade
);

create table public.asset_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_id uuid not null,
  number integer not null,
  label text not null,
  notes text not null default '',
  author_id uuid not null references public.profiles (id) on delete restrict,
  storage_bucket text,
  storage_path text,
  mime_type text,
  byte_size bigint,
  created_at timestamptz not null default now(),
  constraint asset_versions_number_check check (number > 0),
  constraint asset_versions_label_check check (char_length(btrim(label)) > 0),
  constraint asset_versions_byte_size_check check (byte_size is null or byte_size >= 0),
  constraint asset_versions_asset_number_key unique (asset_id, number),
  constraint asset_versions_asset_fkey
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id)
    on delete cascade
);

create table public.asset_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete restrict,
  body text not null,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint asset_comments_body_check check (char_length(btrim(body)) > 0),
  constraint asset_comments_asset_fkey
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id)
    on delete cascade
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  verb text not null,
  summary text not null,
  project_id uuid,
  campaign_id uuid references public.campaigns (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  deliverable_id uuid references public.deliverables (id) on delete set null,
  asset_id uuid references public.assets (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint activity_events_verb_check check (verb ~ '^[a-z_]+$'),
  constraint activity_events_summary_check check (char_length(btrim(summary)) > 0),
  constraint activity_events_project_fkey
    foreign key (organization_id, project_id)
    references public.projects (organization_id, id)
    on delete restrict
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  activity_event_id uuid references public.activity_events (id) on delete set null,
  title text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_title_check check (char_length(btrim(title)) > 0)
);

create index departments_organization_id_idx on public.departments (organization_id);
create index organization_memberships_profile_id_idx on public.organization_memberships (profile_id);
create index department_memberships_profile_id_idx on public.department_memberships (profile_id);
create index projects_organization_status_idx on public.projects (organization_id, status);
create index projects_owner_id_idx on public.projects (owner_id);
create index projects_active_idx on public.projects (organization_id, updated_at desc) where archived_at is null;
create index project_members_profile_project_idx on public.project_members (profile_id, project_id);
create index campaigns_project_status_idx on public.campaigns (project_id, status);
create index campaigns_active_idx on public.campaigns (project_id, updated_at desc) where archived_at is null;
create index tasks_assignee_status_idx on public.tasks (assignee_id, status);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_campaign_id_idx on public.tasks (campaign_id);
create index tasks_active_idx on public.tasks (project_id, updated_at desc) where archived_at is null;
create index deliverables_campaign_status_idx on public.deliverables (campaign_id, status);
create index deliverables_creator_id_idx on public.deliverables (creator_id);
create index deliverables_asset_id_idx on public.deliverables (asset_id);
create index assets_organization_type_idx on public.assets (organization_id, type);
create index assets_owner_id_idx on public.assets (owner_id);
create index assets_active_updated_idx on public.assets (organization_id, updated_at desc) where archived_at is null;
create index assets_tags_idx on public.assets using gin (tags);
create index assets_search_idx on public.assets using gin (search_document);
create index approval_requests_deliverable_idx on public.approval_requests (deliverable_id, created_at desc);
create index asset_access_profile_id_idx on public.asset_access (profile_id);
create index asset_versions_asset_id_idx on public.asset_versions (asset_id, number desc);
create index asset_comments_asset_created_idx on public.asset_comments (asset_id, created_at desc);
create index activity_events_organization_created_idx on public.activity_events (organization_id, created_at desc);
create index activity_events_project_created_idx on public.activity_events (project_id, created_at desc);
create index notifications_recipient_idx on public.notifications (recipient_id, read_at, created_at desc);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.reject_organization_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot change';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_member_flags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'viewer' then
    new.can_edit = false;
    new.can_manage_members = false;
    new.can_approve_deliverables = false;
    new.can_manage_assets = false;
    new.can_comment = false;
  end if;
  return new;
end;
$$;

create or replace function private.protect_project_owner_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.projects project
    where project.id = old.project_id
      and project.owner_id = old.profile_id
  ) then
    raise exception 'reassign the project owner before removing that membership';
  end if;
  return old;
end;
$$;

create or replace function private.ensure_project_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (
    organization_id, project_id, profile_id, role,
    can_edit, can_manage_members, can_approve_deliverables, can_manage_assets, can_comment
  )
  values (
    new.organization_id, new.id, new.owner_id, 'project_manager',
    true, true, false, true, true
  )
  on conflict (project_id, profile_id) do nothing;

  if auth.uid() is not null and auth.uid() is distinct from new.owner_id then
    insert into public.project_members (
      organization_id, project_id, profile_id, role,
      can_edit, can_manage_members, can_approve_deliverables, can_manage_assets, can_comment
    )
    values (
      new.organization_id, new.id, auth.uid(), 'project_manager',
      true, true, false, true, true
    )
    on conflict (project_id, profile_id) do nothing;
  end if;

  insert into public.project_departments (organization_id, project_id, department_id)
  values (new.organization_id, new.id, new.lead_department_id)
  on conflict (project_id, department_id) do nothing;

  return null;
end;
$$;

create or replace function private.enforce_campaign_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.project_members member
    where member.project_id = new.project_id
      and member.profile_id = new.owner_id
      and member.organization_id = new.organization_id
  ) then
    raise exception 'campaign owner must be a member of the project';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_task_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.campaign_id is not null and not exists (
    select 1
    from public.campaigns campaign
    where campaign.id = new.campaign_id
      and campaign.project_id = new.project_id
      and campaign.organization_id = new.organization_id
  ) then
    raise exception 'task campaign must belong to the same project';
  end if;

  if new.assignee_id is not null and not exists (
    select 1
    from public.project_members member
    where member.project_id = new.project_id
      and member.profile_id = new.assignee_id
      and member.organization_id = new.organization_id
  ) then
    raise exception 'assignee must be a member of the project';
  end if;

  return new;
end;
$$;

-- Rows here are written only by security definer functions. RLS is on and no
-- policy is added, so a grant to anon or authenticated still cannot read or write it.
-- Row level security is not forced: the table owner is the function owner and must insert.
create table private.operation_guard (
  operation text not null,
  subject_id uuid not null,
  primary key (operation, subject_id)
);

alter table private.operation_guard enable row level security;
revoke all on table private.operation_guard from public, anon, authenticated;

create or replace function private.operation_is_open(target_operation text, target_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.operation_guard guard
    where guard.operation = target_operation
      and guard.subject_id = target_subject
  );
$$;

create or replace function private.open_operation(target_operation text, target_subject uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.operation_guard (operation, subject_id)
  values (target_operation, target_subject)
  on conflict (operation, subject_id) do nothing;
end;
$$;

create or replace function private.close_operation(target_operation text, target_subject uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.operation_guard
  where operation = target_operation
    and subject_id = target_subject;
end;
$$;

create or replace function private.enforce_deliverable_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.asset_id is not null and not exists (
    select 1
    from public.assets asset
    where asset.id = new.asset_id
      and asset.organization_id = new.organization_id
  ) then
    raise exception 'linked asset must belong to the same organization';
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.creator_id is distinct from auth.uid() then
      raise exception 'creator_id must be the signed-in user';
    end if;
    if not private.operation_is_open('deliverable_status', new.id) then
      new.status = 'draft';
    end if;
  elsif new.status is distinct from old.status
    and not private.operation_is_open('deliverable_status', new.id) then
    raise exception 'deliverable status changes go through start_deliverable, submit_deliverable, or review_deliverable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_signed_in_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.owner_id is distinct from auth.uid() then
    raise exception 'owner_id must be the signed-in user';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_comment_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.author_id is distinct from auth.uid() then
      raise exception 'author_id must be the signed-in user';
    end if;
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
    or new.asset_id is distinct from old.asset_id
    or new.author_id is distinct from old.author_id
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at then
    raise exception 'only the resolved state of a comment can change';
  end if;

  if new.resolved_at is not null and old.resolved_at is null then
    new.resolved_by = coalesce(auth.uid(), new.resolved_by);
  elsif new.resolved_at is null then
    new.resolved_by = null;
  end if;

  return new;
end;
$$;

create or replace function private.enforce_version_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.author_id is distinct from auth.uid() then
    raise exception 'author_id must be the signed-in user';
  end if;
  if new.storage_path is not null
    and not private.operation_is_open('asset_storage', new.id) then
    raise exception 'storage paths are assigned by the upload path, not the client'
      using errcode = '42501';
  end if;
  if new.storage_path is not null and new.storage_path !~ (
    '^' || new.organization_id::text || '/' || new.asset_id::text || '/v' || new.number::text || '/[^/]+$'
  ) then
    raise exception 'storage path does not match this asset version';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_approval_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.operation_is_open('approval', new.deliverable_id) then
    raise exception 'approval requests are written by deliverable transitions'
      using errcode = '42501';
  end if;
  if auth.uid() is not null and new.actor_id is distinct from auth.uid() then
    raise exception 'actor_id must be the signed-in user';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_activity_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.operation_is_open('activity', new.id) then
    raise exception 'activity is recorded by the database' using errcode = '42501';
  end if;
  if auth.uid() is not null and new.actor_id is distinct from auth.uid() then
    raise exception 'actor_id must be the signed-in user';
  end if;
  if new.campaign_id is not null and not exists (
    select 1 from public.campaigns item
    where item.id = new.campaign_id and item.organization_id = new.organization_id
  ) then
    raise exception 'activity campaign must belong to the same organization';
  end if;
  if new.task_id is not null and not exists (
    select 1 from public.tasks item
    where item.id = new.task_id and item.organization_id = new.organization_id
  ) then
    raise exception 'activity task must belong to the same organization';
  end if;
  if new.deliverable_id is not null and not exists (
    select 1 from public.deliverables item
    where item.id = new.deliverable_id and item.organization_id = new.organization_id
  ) then
    raise exception 'activity deliverable must belong to the same organization';
  end if;
  if new.asset_id is not null and not exists (
    select 1 from public.assets item
    where item.id = new.asset_id and item.organization_id = new.organization_id
  ) then
    raise exception 'activity asset must belong to the same organization';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_notification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not private.operation_is_open('notification', new.activity_event_id) then
      raise exception 'notifications are created by the database' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
    or new.recipient_id is distinct from old.recipient_id
    or new.activity_event_id is distinct from old.activity_event_id
    or new.title is distinct from old.title
    or new.created_at is distinct from old.created_at then
    raise exception 'only read_at can change on a notification';
  end if;
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function private.touch_updated_at();
create trigger projects_reject_organization_change
  before update on public.projects
  for each row execute function private.reject_organization_change();
create trigger projects_ensure_owner
  after insert or update of owner_id, lead_department_id on public.projects
  for each row execute function private.ensure_project_owner();

create trigger project_members_enforce_flags
  before insert or update on public.project_members
  for each row execute function private.enforce_member_flags();
create trigger project_members_protect_owner
  before delete on public.project_members
  for each row execute function private.protect_project_owner_membership();

create trigger campaigns_touch_updated_at
  before update on public.campaigns
  for each row execute function private.touch_updated_at();
create trigger campaigns_reject_organization_change
  before update on public.campaigns
  for each row execute function private.reject_organization_change();
create trigger campaigns_enforce_owner
  before insert or update of owner_id, project_id, organization_id on public.campaigns
  for each row execute function private.enforce_campaign_owner();

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function private.touch_updated_at();
create trigger tasks_reject_organization_change
  before update on public.tasks
  for each row execute function private.reject_organization_change();
create trigger tasks_enforce_rules
  before insert or update on public.tasks
  for each row execute function private.enforce_task_rules();

create trigger deliverables_touch_updated_at
  before update on public.deliverables
  for each row execute function private.touch_updated_at();
create trigger deliverables_reject_organization_change
  before update on public.deliverables
  for each row execute function private.reject_organization_change();
create trigger deliverables_enforce_status
  before insert or update on public.deliverables
  for each row execute function private.enforce_deliverable_status();

create trigger assets_touch_updated_at
  before update on public.assets
  for each row execute function private.touch_updated_at();
create trigger assets_reject_organization_change
  before update on public.assets
  for each row execute function private.reject_organization_change();
create trigger assets_enforce_owner
  before insert on public.assets
  for each row execute function private.enforce_signed_in_owner();

create trigger asset_comments_enforce_author
  before insert or update on public.asset_comments
  for each row execute function private.enforce_comment_author();

create trigger asset_versions_enforce_metadata
  before insert or update on public.asset_versions
  for each row execute function private.enforce_version_metadata();

create trigger approval_requests_enforce_actor
  before insert on public.approval_requests
  for each row execute function private.enforce_approval_actor();

create trigger activity_events_enforce_actor
  before insert on public.activity_events
  for each row execute function private.enforce_activity_actor();

create trigger notifications_enforce_update
  before insert or update on public.notifications
  for each row execute function private.enforce_notification_update();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Deny the Data API until the authorization migration adds policies and grants.
alter table public.organizations enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.department_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.project_departments enable row level security;
alter table public.project_members enable row level security;
alter table public.campaigns enable row level security;
alter table public.tasks enable row level security;
alter table public.deliverables enable row level security;
alter table public.approval_requests enable row level security;
alter table public.assets enable row level security;
alter table public.asset_access enable row level security;
alter table public.asset_project_links enable row level security;
alter table public.asset_campaign_links enable row level security;
alter table public.asset_versions enable row level security;
alter table public.asset_comments enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;

alter table public.organizations force row level security;
alter table public.departments force row level security;
alter table public.profiles force row level security;
alter table public.organization_memberships force row level security;
alter table public.department_memberships force row level security;
alter table public.projects force row level security;
alter table public.project_departments force row level security;
alter table public.project_members force row level security;
alter table public.campaigns force row level security;
alter table public.tasks force row level security;
alter table public.deliverables force row level security;
alter table public.approval_requests force row level security;
alter table public.assets force row level security;
alter table public.asset_access force row level security;
alter table public.asset_project_links force row level security;
alter table public.asset_campaign_links force row level security;
alter table public.asset_versions force row level security;
alter table public.asset_comments force row level security;
alter table public.activity_events force row level security;
alter table public.notifications force row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'departments', 'profiles', 'organization_memberships',
    'department_memberships', 'projects', 'project_departments', 'project_members',
    'campaigns', 'tasks', 'deliverables', 'approval_requests', 'assets',
    'asset_access', 'asset_project_links', 'asset_campaign_links', 'asset_versions',
    'asset_comments', 'activity_events', 'notifications'
  ]
  loop
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      table_name
    );
  end loop;
end;
$$;

revoke all on function private.touch_updated_at() from public;
revoke all on function private.reject_organization_change() from public;
revoke all on function private.enforce_member_flags() from public;
revoke all on function private.protect_project_owner_membership() from public;
revoke all on function private.ensure_project_owner() from public;
revoke all on function private.enforce_campaign_owner() from public;
revoke all on function private.enforce_task_rules() from public;
revoke all on function private.enforce_deliverable_status() from public;
revoke all on function private.enforce_signed_in_owner() from public;
revoke all on function private.enforce_comment_author() from public;
revoke all on function private.enforce_version_metadata() from public;
revoke all on function private.enforce_approval_actor() from public;
revoke all on function private.enforce_activity_actor() from public;
revoke all on function private.enforce_notification_update() from public;
revoke all on function private.handle_new_user() from public;
revoke all on function private.operation_is_open(text, uuid) from public, anon, authenticated;
revoke all on function private.open_operation(text, uuid) from public, anon, authenticated;
revoke all on function private.close_operation(text, uuid) from public, anon, authenticated;
