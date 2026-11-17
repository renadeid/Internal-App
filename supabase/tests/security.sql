-- Local security checks for the Company Hub schema.
-- Do not run this against the remote Supabase project.
-- Run it only on a disposable local database after both migrations:
--   psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
-- The script rolls back. A raised exception is a failed check.

begin;

create or replace function pg_temp.assert_eq(actual bigint, expected bigint, message text)
returns void
language plpgsql
as $$
begin
  if actual is distinct from expected then
    raise exception '% (expected %, got %)', message, expected, actual;
  end if;
end;
$$;

create or replace function pg_temp.assert_sqlstate(statement text, expected text, message text)
returns void
language plpgsql
as $$
begin
  execute statement;
  raise exception 'check passed unexpectedly' using errcode = 'P0001';
exception
  when others then
    if sqlstate = expected then
      return;
    end if;
    if sqlstate = 'P0001' then
      raise exception '% did not fail', message;
    end if;
    raise exception '% failed with % instead of %', message, sqlstate, expected;
end;
$$;

do $$
declare
  missing_rls text;
begin
  select string_agg(class.relname, ', ' order by class.relname)
  into missing_rls
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relkind = 'r'
    and class.relname in (
      'organizations', 'departments', 'profiles', 'organization_memberships',
      'department_memberships', 'projects', 'project_departments', 'project_members',
      'campaigns', 'tasks', 'deliverables', 'approval_requests', 'assets',
      'asset_access', 'asset_project_links', 'asset_campaign_links', 'asset_versions',
      'asset_comments', 'activity_events', 'notifications'
    )
    and (class.relrowsecurity is not true or class.relforcerowsecurity is not true);

  if missing_rls is not null then
    raise exception 'RLS is not enabled and forced on: %', missing_rls;
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and table_name in ('projects', 'campaigns', 'tasks', 'deliverables', 'assets', 'approval_requests', 'activity_events')
      and privilege_type = 'DELETE'
  ) then
    raise exception 'authenticated or anon can delete work records';
  end if;

  if exists (
    select 1
    from information_schema.column_privileges
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'deliverables'
      and column_name = 'status'
      and privilege_type = 'UPDATE'
  ) then
    raise exception 'authenticated can update deliverables.status directly';
  end if;
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'authenticated', 'authenticated', 'maya@northline.test', '', now(), '{}'::jsonb, '{"full_name":"Maya Chen"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'authenticated', 'authenticated', 'priya@northline.test', '', now(), '{}'::jsonb, '{"full_name":"Priya Shah"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'authenticated', 'authenticated', 'leo@northline.test', '', now(), '{}'::jsonb, '{"full_name":"Leo Park"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'authenticated', 'authenticated', 'sam@northline.test', '', now(), '{}'::jsonb, '{"full_name":"Sam Ortega"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'authenticated', 'authenticated', 'nora@other.test', '', now(), '{}'::jsonb, '{"full_name":"Nora Blake"}'::jsonb, now(), now(), '', '', '', '');

insert into public.organizations (id, name, slug)
values
  ('11111111-1111-4111-8111-111111111111', 'Northline', 'northline'),
  ('22222222-2222-4222-8222-222222222222', 'Other Co', 'other-co');

insert into public.departments (id, organization_id, name, slug)
values
  ('33333333-3333-4333-8333-333333333331', '11111111-1111-4111-8111-111111111111', 'Marketing', 'marketing'),
  ('33333333-3333-4333-8333-333333333332', '11111111-1111-4111-8111-111111111111', 'Engineering', 'engineering');

insert into public.organization_memberships (organization_id, profile_id, role)
values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'org_admin'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'member'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'member'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'viewer'),
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'org_admin');

insert into public.department_memberships (organization_id, department_id, profile_id, role)
values
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'manager'),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'manager');

insert into public.projects (id, organization_id, slug, name, lead_department_id, owner_id)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '11111111-1111-4111-8111-111111111111', 'spring', 'Spring launch', '33333333-3333-4333-8333-333333333331', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '11111111-1111-4111-8111-111111111111', 'brand', 'Brand system', '33333333-3333-4333-8333-333333333331', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');

update public.project_members
set can_approve_deliverables = true
where project_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  and profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

insert into public.project_members (organization_id, project_id, profile_id, role, can_comment)
values
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'project_member', true);

insert into public.project_members (
  organization_id, project_id, profile_id, role, can_edit, can_manage_members, can_approve_deliverables, can_manage_assets, can_comment
)
values (
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  'viewer',
  true, true, true, true, true
);

select pg_temp.assert_eq(
  (select count(*) from public.project_members where profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4' and can_edit),
  0,
  'viewer write flags are cleared'
);

insert into public.project_members (organization_id, project_id, profile_id, role)
values (
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  'viewer'
);

insert into public.campaigns (
  id, organization_id, project_id, slug, name, owner_id, type, starts_on, ends_on
)
values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'campaign-launch',
  'Launch',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'content',
  '2026-03-02',
  '2026-04-14'
),
(
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'campaign-brand',
  'Brand',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'content',
  '2026-03-02',
  '2026-04-14'
);

insert into public.deliverables (
  id, organization_id, project_id, campaign_id, title, type, creator_id, status
)
values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'Sales one-pager',
  'document',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'approved'
);

select pg_temp.assert_eq(
  (select count(*) from public.deliverables where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1' and status = 'draft'),
  1,
  'inserted deliverables stay draft until a transition function runs'
);

select set_config('app.allow_status_change', 'on', true);
insert into public.deliverables (
  id, organization_id, project_id, campaign_id, title, type, creator_id, status
)
values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd9',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'Forced approval',
  'document',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'approved'
);
select pg_temp.assert_eq(
  (select count(*) from public.deliverables where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd9' and status = 'draft'),
  1,
  'app.allow_status_change does not keep a supplied status'
);

insert into public.assets (id, organization_id, slug, name, type, owner_id, visibility)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', '11111111-1111-4111-8111-111111111111', 'asset-restricted', 'Restricted board', 'design', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'restricted'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', '11111111-1111-4111-8111-111111111111', 'asset-company', 'Company logo', 'image', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'company'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', '11111111-1111-4111-8111-111111111111', 'asset-project', 'Project stills', 'image', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'project_members'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4', '11111111-1111-4111-8111-111111111111', 'asset-viewer', 'Viewer original', 'image', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'company'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', '11111111-1111-4111-8111-111111111111', 'asset-member', 'Member original', 'image', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'company');

insert into public.asset_project_links (organization_id, asset_id, project_id, linked_by)
values
  ('11111111-1111-4111-8111-111111111111', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('11111111-1111-4111-8111-111111111111', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('11111111-1111-4111-8111-111111111111', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');

insert into public.asset_access (organization_id, asset_id, profile_id)
values (
  '11111111-1111-4111-8111-111111111111',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
);

insert into public.asset_campaign_links (organization_id, asset_id, campaign_id, linked_by)
values (
  '11111111-1111-4111-8111-111111111111',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
);

select set_config('app.allow_approval', 'on', true);
select pg_temp.assert_sqlstate(
  $$insert into public.approval_requests (
      organization_id, deliverable_id, project_id, action, from_status, to_status, actor_id
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'start',
      'draft',
      'in_progress',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    )$$,
  '42501',
  'app.allow_approval does not write an approval'
);

select set_config('app.allow_activity', 'on', true);
select pg_temp.assert_sqlstate(
  $$insert into public.activity_events (organization_id, actor_id, verb, summary, project_id)
    values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'created',
      'forged',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
    )$$,
  '42501',
  'app.allow_activity does not write activity'
);

select set_config('app.allow_notification', 'on', true);
select pg_temp.assert_sqlstate(
  $$insert into public.notifications (organization_id, recipient_id, title)
    values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'forged'
    )$$,
  '42501',
  'app.allow_notification does not write a notification'
);

select set_config('app.allow_storage_path', 'on', true);
select pg_temp.assert_sqlstate(
  $$insert into public.asset_versions (
      organization_id, asset_id, number, label, author_id, storage_path
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
      1,
      'v1',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      '11111111-1111-4111-8111-111111111111/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2/v1/file.png'
    )$$,
  '42501',
  'app.allow_storage_path does not assign a storage path'
);

select pg_temp.assert_sqlstate(
  $$insert into public.tasks (organization_id, project_id, campaign_id, title, assignee_id)
    values (
      '11111111-1111-4111-8111-111111111111',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'Wrong project',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    )$$,
  'P0001',
  'task campaign project mismatch'
);

select pg_temp.assert_sqlstate(
  $$insert into public.tasks (organization_id, project_id, title, assignee_id)
    values (
      '11111111-1111-4111-8111-111111111111',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'Outside assignee',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'
    )$$,
  'P0001',
  'assignee outside the project'
);

select pg_temp.assert_sqlstate(
  $$insert into public.deliverables (organization_id, project_id, campaign_id, title, type, creator_id)
    values (
      '11111111-1111-4111-8111-111111111111',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'Mismatched',
      'copy',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
    )$$,
  '23503',
  'deliverable project differs from its campaign'
);

set local role anon;
select pg_temp.assert_sqlstate(
  'select count(*) from public.organizations',
  '42501',
  'anon cannot read organizations'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3","role":"authenticated"}', true);

select pg_temp.assert_eq(
  (select count(*) from public.projects where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
  0,
  'department manager without membership cannot read the project'
);
select pg_temp.assert_eq(
  (select count(*) from public.assets where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),
  1,
  'organization member can read a company asset'
);
select pg_temp.assert_eq(
  (select count(*) from public.assets where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3'),
  0,
  'project asset is hidden from someone outside the project'
);

insert into public.projects (id, organization_id, slug, name, lead_department_id, owner_id)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  '11111111-1111-4111-8111-111111111111',
  'leo-plan',
  'Leo plan',
  '33333333-3333-4333-8333-333333333331',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
);

select pg_temp.assert_sqlstate(
  $$update public.project_members
    set can_approve_deliverables = true
    where project_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'
      and profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'$$,
  '42501',
  'a project manager who is not an organization admin cannot grant approval'
);

select pg_temp.assert_sqlstate(
  $$insert into public.project_members (
      organization_id, project_id, profile_id, role, can_approve_deliverables
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      'project_member',
      true
    )$$,
  '42501',
  'a project manager cannot insert a member who can approve deliverables'
);

insert into public.project_members (organization_id, project_id, profile_id, role, can_comment)
values (
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'project_member',
  true
);

select pg_temp.assert_eq(
  (select count(*) from public.project_members
    where project_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'
      and can_approve_deliverables),
  0,
  'approval stays off when a project manager changes membership'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5","role":"authenticated"}', true);

select pg_temp.assert_eq(
  (select count(*) from public.organizations where id = '11111111-1111-4111-8111-111111111111'),
  0,
  'another organization is not visible'
);
select pg_temp.assert_eq(
  (select count(*) from public.projects where organization_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'projects from another organization are not visible'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}', true);

select pg_temp.assert_eq(
  (select count(*) from public.organizations where id = '22222222-2222-4222-8222-222222222222'),
  0,
  'organization admin cannot read another organization'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","role":"authenticated"}', true);

select pg_temp.assert_eq(
  (select count(*) from public.assets where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  0,
  'restricted asset is hidden from a project member who is not on the access list'
);
select pg_temp.assert_eq(
  (select count(*) from public.assets where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3'),
  1,
  'project member can read a project asset'
);

insert into public.asset_access (organization_id, asset_id, profile_id)
values (
  '11111111-1111-4111-8111-111111111111',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
);
select pg_temp.assert_eq(
  (select count(*) from public.asset_access where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'),
  1,
  'organization member who owns an asset can grant access'
);
delete from public.asset_access where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5';
select pg_temp.assert_eq(
  (select count(*) from public.asset_access where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'),
  0,
  'organization member who owns an asset can remove access'
);

insert into public.asset_project_links (organization_id, asset_id, project_id, linked_by)
values (
  '11111111-1111-4111-8111-111111111111',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
);
select pg_temp.assert_eq(
  (select count(*) from public.asset_project_links where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'),
  1,
  'organization member who owns an asset can link it to a project'
);
delete from public.asset_project_links where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5';
select pg_temp.assert_eq(
  (select count(*) from public.asset_project_links where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'),
  0,
  'organization member who owns an asset can unlink it from a project'
);

insert into public.asset_campaign_links (organization_id, asset_id, campaign_id, linked_by)
values (
  '11111111-1111-4111-8111-111111111111',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
);
select pg_temp.assert_eq(
  (select count(*) from public.asset_campaign_links where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'),
  1,
  'organization member who owns an asset can link it to a campaign'
);
delete from public.asset_campaign_links where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5';
select pg_temp.assert_eq(
  (select count(*) from public.asset_campaign_links where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'),
  0,
  'organization member who owns an asset can unlink it from a campaign'
);

select public.submit_deliverable('dddddddd-dddd-4ddd-8ddd-ddddddddddd1');

select set_config('app.allow_status_change', 'on', true);
insert into public.deliverables (
  id, organization_id, project_id, campaign_id, title, type, creator_id, status
)
values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'Second forced approval',
  'document',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'approved'
);
select pg_temp.assert_eq(
  (select count(*) from public.deliverables where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2' and status = 'draft'),
  1,
  'a finished transition does not leave status changes open'
);

select pg_temp.assert_sqlstate(
  $$select private.open_operation('deliverable_status', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1')$$,
  '42501',
  'authenticated cannot open an operation guard'
);

select set_config('app.allow_activity', 'on', true);
select set_config('app.allow_notification', 'on', true);
select set_config('app.allow_approval', 'on', true);

select pg_temp.assert_sqlstate(
  $$select public.review_deliverable('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'approved', '')$$,
  '42501',
  'creator without approval permission cannot approve'
);

select pg_temp.assert_sqlstate(
  $$update public.deliverables set status = 'approved' where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'$$,
  '42501',
  'direct deliverable status update is rejected'
);

select pg_temp.assert_sqlstate(
  $$insert into public.activity_events (organization_id, actor_id, verb, summary, project_id)
    values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'created',
      'forged',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
    )$$,
  '42501',
  'client cannot insert activity for another actor'
);

select pg_temp.assert_sqlstate(
  $$insert into public.notifications (organization_id, recipient_id, title)
    values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'forged'
    )$$,
  '42501',
  'client cannot insert a notification'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4","role":"authenticated"}', true);

select pg_temp.assert_eq(
  (select count(*) from public.assets where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4'),
  1,
  'organization viewer can read a company asset they own'
);
select pg_temp.assert_sqlstate(
  $$update public.assets set name = 'Taken' where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4'$$,
  '42501',
  'organization viewer cannot manage an asset by ownership'
);
select pg_temp.assert_sqlstate(
  $$insert into public.asset_comments (organization_id, asset_id, author_id, body)
    values (
      '11111111-1111-4111-8111-111111111111',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
      'note'
    )$$,
  '42501',
  'organization viewer cannot comment by ownership'
);
select pg_temp.assert_sqlstate(
  $$insert into public.asset_access (organization_id, asset_id, profile_id)
    values (
      '11111111-1111-4111-8111-111111111111',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
    )$$,
  '42501',
  'organization viewer cannot grant access to an asset they own'
);
delete from public.asset_access where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4';
select pg_temp.assert_eq(
  (select count(*) from public.asset_access where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4'),
  1,
  'organization viewer cannot remove access from an asset they own'
);
select pg_temp.assert_sqlstate(
  $$insert into public.asset_project_links (organization_id, asset_id, project_id, linked_by)
    values (
      '11111111-1111-4111-8111-111111111111',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'
    )$$,
  '42501',
  'organization viewer cannot link an owned asset to a project'
);
delete from public.asset_project_links where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4';
select pg_temp.assert_eq(
  (select count(*) from public.asset_project_links where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4'),
  1,
  'organization viewer cannot unlink an owned asset from a project'
);
select pg_temp.assert_sqlstate(
  $$insert into public.asset_campaign_links (organization_id, asset_id, campaign_id, linked_by)
    values (
      '11111111-1111-4111-8111-111111111111',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'
    )$$,
  '42501',
  'organization viewer cannot link an owned asset to a campaign'
);
delete from public.asset_campaign_links where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4';
select pg_temp.assert_eq(
  (select count(*) from public.asset_campaign_links where asset_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4'),
  1,
  'organization viewer cannot unlink an owned asset from a campaign'
);

select pg_temp.assert_sqlstate(
  $$insert into public.tasks (organization_id, project_id, title)
    values (
      '11111111-1111-4111-8111-111111111111',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'Viewer task'
    )$$,
  '42501',
  'project viewer cannot create a task'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}', true);

select public.review_deliverable('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'approved', 'Ready');

select pg_temp.assert_eq(
  (select count(*) from public.approval_requests where deliverable_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1' and actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and to_status = 'approved'),
  1,
  'approval actor is the signed-in reviewer'
);
select pg_temp.assert_eq(
  (select count(*) from public.notifications where recipient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and title like 'approved %'),
  0,
  'the actor is not notified about their own action'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","role":"authenticated"}', true);

select pg_temp.assert_eq(
  (select count(*) from public.notifications where recipient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2' and title like 'approved %'),
  1,
  'the other project member receives the approval notification'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}', true);

select pg_temp.assert_sqlstate(
  $$select public.review_deliverable('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'changes_requested', 'Again')$$,
  'P0001',
  'a second review is rejected'
);

reset role;

select pg_temp.assert_sqlstate(
  $$update public.deliverables
    set status = 'draft'
    where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'$$,
  '42501',
  'a finished review does not leave status changes open'
);
select pg_temp.assert_sqlstate(
  $$insert into public.approval_requests (
      organization_id, deliverable_id, project_id, action, from_status, to_status, actor_id
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'approve',
      'submitted',
      'approved',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    )$$,
  '42501',
  'a finished review does not leave approval writes open'
);
select pg_temp.assert_sqlstate(
  $$insert into public.notifications (organization_id, recipient_id, activity_event_id, title)
    select
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      event.id,
      'forged'
    from public.activity_events event
    where event.deliverable_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
    limit 1$$,
  '42501',
  'a finished review does not leave notification writes open'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}', true);

update public.project_members
set can_approve_deliverables = true
where project_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  and profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

select pg_temp.assert_eq(
  (select count(*) from public.project_members
    where project_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
      and profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
      and can_approve_deliverables),
  1,
  'an organization admin can grant deliverable approval'
);

reset role;

rollback;
