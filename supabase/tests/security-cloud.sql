-- Cloud-safe security checks for the Company Hub schema.
-- Run the whole file once in the Supabase SQL Editor on an isolated test project.
-- Do not run a selection. The script starts a transaction and ends with rollback.
-- It does not write auth.users, auth schema objects, storage, or existing profile rows.
--
-- SET LOCAL ROLE and RESET ROLE appear only as top-level statements.
-- PostgreSQL rejects those commands inside a function or DO block.
-- The DO block below only prepares disposable rows and records their ids.
--
-- Create these five disposable users once, in Authentication, before running this file.
-- Do not insert them with SQL. The profile trigger creates public.profiles.
--   security-admin@company-hub-test.invalid
--   security-member@company-hub-test.invalid
--   security-manager@company-hub-test.invalid
--   security-viewer@company-hub-test.invalid
--   security-outsider@company-hub-test.invalid
--
-- This session has not executed this file. A successful editor run is still required.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local idle_in_transaction_session_timeout = '120s';

create or replace function pg_temp.assert_eq(actual bigint, expected bigint, message text)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
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
security invoker
set search_path = pg_catalog
as $$
declare
  observed text;
begin
  begin
    execute statement;
  exception
    when others then
      observed := sqlstate;
  end;

  if observed is null then
    raise exception '% did not fail', message;
  elsif observed is distinct from expected then
    raise exception '% failed with % instead of %', message, observed, expected;
  end if;
end;
$$;

create or replace function pg_temp.fixture(setting_name text)
returns uuid
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select pg_catalog.current_setting(setting_name, false)::pg_catalog.uuid;
$$;

create or replace function pg_temp.assume_user(target_user uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', target_user::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object('sub', target_user, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- pg_temp is a session alias, not a schema name GRANT accepts reliably.
-- Grant usage on the real temporary schema created by the functions above.
do $grant_temp$
declare
  temp_schema name;
begin
  select nspname
  into temp_schema
  from pg_namespace
  where oid = pg_catalog.pg_my_temp_schema();

  if temp_schema is null then
    raise exception 'temporary schema was not created for the test helpers';
  end if;

  execute format('grant usage on schema %I to anon, authenticated', temp_schema);
end
$grant_temp$;

grant execute on function pg_temp.assert_eq(bigint, bigint, text) to anon, authenticated;
grant execute on function pg_temp.assert_sqlstate(text, text, text) to anon, authenticated;
grant execute on function pg_temp.fixture(text) to anon, authenticated;
grant execute on function pg_temp.assume_user(uuid) to anon, authenticated;

do $fixture$
#variable_conflict use_variable
declare
  v_admin_id uuid;
  v_member_id uuid;
  v_manager_id uuid;
  v_viewer_id uuid;
  v_outsider_id uuid;
  v_missing_emails text;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_org_a uuid := gen_random_uuid();
  v_org_b uuid := gen_random_uuid();
  v_dept_marketing uuid := gen_random_uuid();
  v_dept_engineering uuid := gen_random_uuid();
  v_project_spring uuid := gen_random_uuid();
  v_project_brand uuid := gen_random_uuid();
  v_project_manager uuid := gen_random_uuid();
  v_campaign_spring uuid := gen_random_uuid();
  v_campaign_brand uuid := gen_random_uuid();
  v_deliverable_id uuid := gen_random_uuid();
  v_deliverable_forced uuid := gen_random_uuid();
  v_deliverable_after uuid := gen_random_uuid();
  v_asset_restricted uuid := gen_random_uuid();
  v_asset_company uuid := gen_random_uuid();
  v_asset_project uuid := gen_random_uuid();
  v_asset_viewer uuid := gen_random_uuid();
  v_asset_member uuid := gen_random_uuid();
  v_missing_rls text;
begin
  if not pg_catalog.pg_has_role(current_user, 'anon', 'SET')
    or not pg_catalog.pg_has_role(current_user, 'authenticated', 'SET') then
    raise exception 'Run the whole script in the Supabase SQL Editor as postgres, which can SET ROLE anon and authenticated';
  end if;

  select string_agg(required_account.required_email, ', ' order by required_account.required_email)
  into v_missing_emails
  from (
    values
      ('security-admin@company-hub-test.invalid'),
      ('security-member@company-hub-test.invalid'),
      ('security-manager@company-hub-test.invalid'),
      ('security-viewer@company-hub-test.invalid'),
      ('security-outsider@company-hub-test.invalid')
  ) as required_account (required_email)
  where not exists (
    select 1
    from public.profiles as profile
    where profile.email = required_account.required_email
  );

  if v_missing_emails is not null then
    raise exception
      'Create these users in Authentication before running this script, and do not insert auth.users with SQL: %',
      v_missing_emails;
  end if;

  select profile.id into v_admin_id
  from public.profiles as profile
  where profile.email = 'security-admin@company-hub-test.invalid';
  select profile.id into v_member_id
  from public.profiles as profile
  where profile.email = 'security-member@company-hub-test.invalid';
  select profile.id into v_manager_id
  from public.profiles as profile
  where profile.email = 'security-manager@company-hub-test.invalid';
  select profile.id into v_viewer_id
  from public.profiles as profile
  where profile.email = 'security-viewer@company-hub-test.invalid';
  select profile.id into v_outsider_id
  from public.profiles as profile
  where profile.email = 'security-outsider@company-hub-test.invalid';

  if (
    select count(distinct found_user.user_id)
    from (
      values (v_admin_id), (v_member_id), (v_manager_id), (v_viewer_id), (v_outsider_id)
    ) as found_user (user_id)
  ) <> 5 then
    raise exception 'The five security test profiles must be five different accounts';
  end if;

  select string_agg(class.relname, ', ' order by class.relname)
  into v_missing_rls
  from pg_class as class
  join pg_namespace as namespace on namespace.oid = class.relnamespace
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

  if v_missing_rls is not null then
    raise exception 'RLS is not enabled and forced on: %', v_missing_rls;
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants as granted
    where granted.grantee in ('anon', 'authenticated')
      and granted.table_schema = 'public'
      and granted.table_name in ('projects', 'campaigns', 'tasks', 'deliverables', 'assets', 'approval_requests', 'activity_events')
      and granted.privilege_type = 'DELETE'
  ) then
    raise exception 'authenticated or anon can delete work records';
  end if;

  if exists (
    select 1
    from information_schema.column_privileges as granted
    where granted.grantee = 'authenticated'
      and granted.table_schema = 'public'
      and granted.table_name = 'deliverables'
      and granted.column_name = 'status'
      and granted.privilege_type = 'UPDATE'
  ) then
    raise exception 'authenticated can update deliverables.status directly';
  end if;

  insert into public.organizations (id, name, slug)
  values
    (v_org_a, 'Security Org A', 'sec-a-' || v_suffix),
    (v_org_b, 'Security Org B', 'sec-b-' || v_suffix);

  insert into public.departments (id, organization_id, name, slug)
  values
    (v_dept_marketing, v_org_a, 'Marketing', 'marketing'),
    (v_dept_engineering, v_org_a, 'Engineering', 'engineering');

  insert into public.organization_memberships (organization_id, profile_id, role)
  values
    (v_org_a, v_admin_id, 'org_admin'),
    (v_org_a, v_member_id, 'member'),
    (v_org_a, v_manager_id, 'member'),
    (v_org_a, v_viewer_id, 'viewer'),
    (v_org_b, v_outsider_id, 'org_admin');

  insert into public.department_memberships (organization_id, department_id, profile_id, role)
  values
    (v_org_a, v_dept_marketing, v_admin_id, 'manager'),
    (v_org_a, v_dept_marketing, v_manager_id, 'manager');

  insert into public.projects (id, organization_id, slug, name, lead_department_id, owner_id)
  values
    (v_project_spring, v_org_a, 'spring-' || v_suffix, 'Spring launch', v_dept_marketing, v_admin_id),
    (v_project_brand, v_org_a, 'brand-' || v_suffix, 'Brand system', v_dept_marketing, v_admin_id);

  update public.project_members as membership
  set can_approve_deliverables = true
  where membership.project_id = v_project_spring
    and membership.profile_id = v_admin_id;

  insert into public.project_members (organization_id, project_id, profile_id, role, can_comment)
  values (v_org_a, v_project_spring, v_member_id, 'project_member', true);

  insert into public.project_members (
    organization_id, project_id, profile_id, role,
    can_edit, can_manage_members, can_approve_deliverables, can_manage_assets, can_comment
  )
  values (v_org_a, v_project_spring, v_viewer_id, 'viewer', true, true, true, true, true);

  perform pg_temp.assert_eq(
    (
      select count(*)
      from public.project_members as membership
      where membership.project_id = v_project_spring
        and membership.profile_id = v_viewer_id
        and membership.can_edit
    ),
    0,
    'viewer write flags are cleared'
  );

  insert into public.project_members (organization_id, project_id, profile_id, role)
  values (v_org_a, v_project_brand, v_viewer_id, 'viewer');

  insert into public.campaigns (
    id, organization_id, project_id, slug, name, owner_id, type, starts_on, ends_on
  )
  values
    (v_campaign_spring, v_org_a, v_project_spring, 'launch-' || v_suffix, 'Launch', v_admin_id, 'content', '2026-03-02', '2026-04-14'),
    (v_campaign_brand, v_org_a, v_project_brand, 'brand-campaign-' || v_suffix, 'Brand', v_admin_id, 'content', '2026-03-02', '2026-04-14');

  insert into public.deliverables (
    id, organization_id, project_id, campaign_id, title, type, creator_id, status
  )
  values (
    v_deliverable_id, v_org_a, v_project_spring, v_campaign_spring,
    'Sales one-pager', 'document', v_member_id, 'approved'
  );

  perform pg_temp.assert_eq(
    (select count(*) from public.deliverables as item where item.id = v_deliverable_id and item.status = 'draft'),
    1,
    'inserted deliverables stay draft until a transition function runs'
  );

  perform set_config('app.allow_status_change', 'on', true);
  insert into public.deliverables (
    id, organization_id, project_id, campaign_id, title, type, creator_id, status
  )
  values (
    v_deliverable_forced, v_org_a, v_project_spring, v_campaign_spring,
    'Forced approval', 'document', v_member_id, 'approved'
  );
  perform pg_temp.assert_eq(
    (select count(*) from public.deliverables as item where item.id = v_deliverable_forced and item.status = 'draft'),
    1,
    'app.allow_status_change does not keep a supplied status'
  );

  insert into public.assets (id, organization_id, slug, name, type, owner_id, visibility)
  values
    (v_asset_restricted, v_org_a, 'restricted-' || v_suffix, 'Restricted board', 'design', v_admin_id, 'restricted'),
    (v_asset_company, v_org_a, 'company-' || v_suffix, 'Company logo', 'image', v_admin_id, 'company'),
    (v_asset_project, v_org_a, 'project-' || v_suffix, 'Project stills', 'image', v_admin_id, 'project_members'),
    (v_asset_viewer, v_org_a, 'viewer-' || v_suffix, 'Viewer original', 'image', v_viewer_id, 'company'),
    (v_asset_member, v_org_a, 'member-' || v_suffix, 'Member original', 'image', v_member_id, 'company');

  insert into public.asset_project_links (organization_id, asset_id, project_id, linked_by)
  values
    (v_org_a, v_asset_restricted, v_project_spring, v_admin_id),
    (v_org_a, v_asset_project, v_project_spring, v_admin_id),
    (v_org_a, v_asset_viewer, v_project_spring, v_admin_id);

  insert into public.asset_access (organization_id, asset_id, profile_id)
  values (v_org_a, v_asset_viewer, v_member_id);

  insert into public.asset_campaign_links (organization_id, asset_id, campaign_id, linked_by)
  values (v_org_a, v_asset_viewer, v_campaign_spring, v_admin_id);

  perform set_config('app.allow_approval', 'on', true);
  perform pg_temp.assert_sqlstate(
    format(
      'insert into public.approval_requests (organization_id, deliverable_id, project_id, action, from_status, to_status, actor_id) values (%L, %L, %L, %L, %L, %L, %L)',
      v_org_a, v_deliverable_id, v_project_spring, 'start', 'draft', 'in_progress', v_admin_id
    ),
    '42501',
    'app.allow_approval does not write an approval'
  );

  perform set_config('app.allow_activity', 'on', true);
  perform pg_temp.assert_sqlstate(
    format(
      'insert into public.activity_events (organization_id, actor_id, verb, summary, project_id) values (%L, %L, %L, %L, %L)',
      v_org_a, v_admin_id, 'created', 'forged', v_project_spring
    ),
    '42501',
    'app.allow_activity does not write activity'
  );

  perform set_config('app.allow_notification', 'on', true);
  perform pg_temp.assert_sqlstate(
    format(
      'insert into public.notifications (organization_id, recipient_id, title) values (%L, %L, %L)',
      v_org_a, v_admin_id, 'forged'
    ),
    '42501',
    'app.allow_notification does not write a notification'
  );

  perform set_config('app.allow_storage_path', 'on', true);
  perform pg_temp.assert_sqlstate(
    format(
      'insert into public.asset_versions (organization_id, asset_id, number, label, author_id, storage_path) values (%L, %L, 1, %L, %L, %L)',
      v_org_a,
      v_asset_company,
      'v1',
      v_admin_id,
      v_org_a::text || '/' || v_asset_company::text || '/v1/file.png'
    ),
    '42501',
    'app.allow_storage_path does not assign a storage path'
  );

  perform pg_temp.assert_sqlstate(
    format(
      'insert into public.tasks (organization_id, project_id, campaign_id, title, assignee_id) values (%L, %L, %L, %L, %L)',
      v_org_a, v_project_brand, v_campaign_spring, 'Wrong project', v_admin_id
    ),
    'P0001',
    'task campaign project mismatch'
  );

  perform pg_temp.assert_sqlstate(
    format(
      'insert into public.tasks (organization_id, project_id, title, assignee_id) values (%L, %L, %L, %L)',
      v_org_a, v_project_spring, 'Outside assignee', v_outsider_id
    ),
    'P0001',
    'assignee outside the project'
  );

  perform pg_temp.assert_sqlstate(
    format(
      'insert into public.deliverables (organization_id, project_id, campaign_id, title, type, creator_id) values (%L, %L, %L, %L, %L, %L)',
      v_org_a, v_project_brand, v_campaign_spring, 'Mismatched', 'copy', v_member_id
    ),
    '23503',
    'deliverable project differs from its campaign'
  );

  perform set_config('security.suffix', v_suffix, true);
  perform set_config('security.admin_id', v_admin_id::text, true);
  perform set_config('security.member_id', v_member_id::text, true);
  perform set_config('security.manager_id', v_manager_id::text, true);
  perform set_config('security.viewer_id', v_viewer_id::text, true);
  perform set_config('security.outsider_id', v_outsider_id::text, true);
  perform set_config('security.org_a', v_org_a::text, true);
  perform set_config('security.org_b', v_org_b::text, true);
  perform set_config('security.dept_marketing', v_dept_marketing::text, true);
  perform set_config('security.project_spring', v_project_spring::text, true);
  perform set_config('security.project_brand', v_project_brand::text, true);
  perform set_config('security.project_manager', v_project_manager::text, true);
  perform set_config('security.campaign_spring', v_campaign_spring::text, true);
  perform set_config('security.campaign_brand', v_campaign_brand::text, true);
  perform set_config('security.deliverable_id', v_deliverable_id::text, true);
  perform set_config('security.deliverable_after', v_deliverable_after::text, true);
  perform set_config('security.asset_restricted', v_asset_restricted::text, true);
  perform set_config('security.asset_company', v_asset_company::text, true);
  perform set_config('security.asset_project', v_asset_project::text, true);
  perform set_config('security.asset_viewer', v_asset_viewer::text, true);
  perform set_config('security.asset_member', v_asset_member::text, true);
end;
$fixture$;

-- Each section sets the role only at the top level, then RESET ROLE returns to the
-- session user before the next section. SET LOCAL stays in effect across the
-- statements in between, and ROLLBACK clears it with the rest of the transaction.
set local role anon;
select pg_temp.assert_sqlstate(
  'select count(*) from public.organizations',
  '42501',
  'anon cannot read organizations'
);
reset role;

select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
select pg_temp.assert_eq(
  (select case when auth.uid() = pg_temp.fixture('security.admin_id') then 1 else 0 end),
  1,
  'auth.uid() did not follow the SQL Editor session settings. Identity checks through the Data API must be run separately'
);
reset role;

select pg_temp.assume_user(pg_temp.fixture('security.manager_id'));
set local role authenticated;
select pg_temp.assert_eq(
  (select count(*) from public.projects where id = pg_temp.fixture('security.project_spring')),
  0,
  'department manager without membership cannot read the project'
);
select pg_temp.assert_eq(
  (select count(*) from public.assets where id = pg_temp.fixture('security.asset_company')),
  1,
  'organization member can read a company asset'
);
select pg_temp.assert_eq(
  (select count(*) from public.assets where id = pg_temp.fixture('security.asset_project')),
  0,
  'project asset is hidden from someone outside the project'
);
insert into public.projects (id, organization_id, slug, name, lead_department_id, owner_id)
select
  pg_temp.fixture('security.project_manager'),
  pg_temp.fixture('security.org_a'),
  'manager-' || current_setting('security.suffix'),
  'Manager plan',
  pg_temp.fixture('security.dept_marketing'),
  pg_temp.fixture('security.manager_id');
select pg_temp.assert_sqlstate(
  format(
    'update public.project_members set can_approve_deliverables = true where project_id = %L and profile_id = %L',
    pg_temp.fixture('security.project_manager'),
    pg_temp.fixture('security.manager_id')
  ),
  '42501',
  'a project manager who is not an organization admin cannot grant approval'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.project_members (organization_id, project_id, profile_id, role, can_approve_deliverables) values (%L, %L, %L, %L, true)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_manager'),
    pg_temp.fixture('security.member_id'),
    'project_member'
  ),
  '42501',
  'a project manager cannot insert a member who can approve deliverables'
);
insert into public.project_members (organization_id, project_id, profile_id, role, can_comment)
select
  pg_temp.fixture('security.org_a'),
  pg_temp.fixture('security.project_manager'),
  pg_temp.fixture('security.member_id'),
  'project_member',
  true;
select pg_temp.assert_eq(
  (select count(*) from public.project_members where project_id = pg_temp.fixture('security.project_manager') and can_approve_deliverables),
  0,
  'approval stays off when a project manager changes membership'
);
reset role;

select pg_temp.assume_user(pg_temp.fixture('security.outsider_id'));
set local role authenticated;
select pg_temp.assert_eq(
  (select count(*) from public.organizations where id = pg_temp.fixture('security.org_a')),
  0,
  'another organization is not visible'
);
select pg_temp.assert_eq(
  (select count(*) from public.projects where organization_id = pg_temp.fixture('security.org_a')),
  0,
  'projects from another organization are not visible'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.tasks (organization_id, project_id, title) values (%L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'Outsider task'
  ),
  '42501',
  'organization outsider cannot create a task'
);
-- The owner trigger runs before campaigns_insert. An outsider cannot see project
-- members, so the trigger rejects the row before the insert policy can raise 42501.
select pg_temp.assert_sqlstate(
  format(
    'insert into public.campaigns (organization_id, project_id, slug, name, owner_id, type, starts_on, ends_on) values (%L, %L, %L, %L, %L, %L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'outsider-campaign',
    'Outsider campaign',
    pg_temp.fixture('security.admin_id'),
    'content',
    '2026-11-01',
    '2026-11-30'
  ),
  'P0001',
  'organization outsider cannot create a campaign'
);
reset role;
select pg_temp.assert_eq(
  (select count(*) from public.campaigns where name = 'Outsider campaign'),
  0,
  'outsider campaign insert does not create a row'
);

select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
select pg_temp.assert_eq(
  (select count(*) from public.organizations where id = pg_temp.fixture('security.org_b')),
  0,
  'organization admin cannot read another organization'
);
insert into public.tasks (organization_id, project_id, title)
values (
  pg_temp.fixture('security.org_a'),
  pg_temp.fixture('security.project_spring'),
  'Admin task'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.tasks as task
    where task.project_id = pg_temp.fixture('security.project_spring')
      and task.title = 'Admin task'
      and task.description = ''
      and task.priority = 'medium'
      and task.status = 'todo'
      and task.assignee_id is null
      and task.campaign_id is null
      and task.archived_at is null
  ),
  1,
  'organization admin can insert a title-only task'
);
insert into public.tasks (organization_id, project_id, title, assignee_id)
values (
  pg_temp.fixture('security.org_a'),
  pg_temp.fixture('security.project_spring'),
  'Viewer assigned task',
  pg_temp.fixture('security.viewer_id')
);
do $admin_update_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set title = 'Admin task updated',
      status = 'in_progress'
  where project_id = pg_temp.fixture('security.project_spring')
    and title = 'Admin task';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'organization admin can update a disposable task'
  );
end
$admin_update_task$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.tasks as task
    where task.organization_id = pg_temp.fixture('security.org_a')
      and task.project_id = pg_temp.fixture('security.project_spring')
      and task.title = 'Admin task updated'
      and task.status = 'in_progress'
      and task.campaign_id is null
  ),
  1,
  'admin task update keeps the organization and project'
);
do $admin_archive_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set archived_at = timestamptz '2026-11-08 12:00:00+00'
  where project_id = pg_temp.fixture('security.project_spring')
    and title = 'Admin task updated'
    and archived_at is null;

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'organization admin can archive a disposable task'
  );
end
$admin_archive_task$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.tasks as task
    where task.organization_id = pg_temp.fixture('security.org_a')
      and task.project_id = pg_temp.fixture('security.project_spring')
      and task.title = 'Admin task updated'
      and task.status = 'in_progress'
      and task.assignee_id is null
      and task.campaign_id is null
      and task.archived_at = timestamptz '2026-11-08 12:00:00+00'
  ),
  1,
  'admin task archive keeps the other task fields'
);
do $admin_restore_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set archived_at = null
  where project_id = pg_temp.fixture('security.project_spring')
    and title = 'Admin task updated'
    and archived_at is not null;

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'organization admin can restore a disposable task'
  );
end
$admin_restore_task$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.tasks as task
    where task.organization_id = pg_temp.fixture('security.org_a')
      and task.project_id = pg_temp.fixture('security.project_spring')
      and task.title = 'Admin task updated'
      and task.status = 'in_progress'
      and task.assignee_id is null
      and task.campaign_id is null
      and task.archived_at is null
  ),
  1,
  'admin task restore keeps the other task fields'
);
insert into public.campaigns (
  organization_id, project_id, slug, name, owner_id, type, status, starts_on, ends_on
)
values (
  pg_temp.fixture('security.org_a'),
  pg_temp.fixture('security.project_spring'),
  'admin-campaign-' || substr(pg_temp.fixture('security.project_spring')::text, 1, 8),
  'Admin campaign',
  pg_temp.fixture('security.admin_id'),
  'content',
  'planning',
  '2026-11-01',
  '2026-11-30'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign'
      and campaign.owner_id = pg_temp.fixture('security.admin_id')
      and campaign.archived_at is null
  ),
  1,
  'organization admin can create a disposable campaign'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.campaigns (organization_id, project_id, slug, name, owner_id, type, status, starts_on, ends_on, archived_at) values (%L, %L, %L, %L, %L, %L, %L, %L, %L, timestamptz ''2026-11-10 10:00:00+00'')',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'archived-insert-campaign',
    'Archived insert campaign',
    pg_temp.fixture('security.admin_id'),
    'content',
    'planning',
    '2026-11-01',
    '2026-11-30'
  ),
  '42501',
  'authenticated cannot insert a campaign with archived_at set'
);
select pg_temp.assert_eq(
  (select count(*) from public.campaigns where name = 'Archived insert campaign'),
  0,
  'archived campaign insert does not create a row'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.campaigns (organization_id, project_id, slug, name, owner_id, type, starts_on, ends_on) values (%L, %L, %L, %L, %L, %L, %L, %L)',
    pg_temp.fixture('security.org_b'),
    pg_temp.fixture('security.project_spring'),
    'cross-org-campaign-insert',
    'Cross organization campaign insert',
    pg_temp.fixture('security.admin_id'),
    'content',
    '2026-11-01',
    '2026-11-30'
  ),
  'P0001',
  'campaign insert into another organization is rejected before the insert policy'
);
select pg_temp.assert_eq(
  (select count(*) from public.campaigns where name = 'Cross organization campaign insert'),
  0,
  'cross-organization campaign insert does not create a row'
);
update public.campaigns
set
  name = 'Admin campaign updated',
  description = 'Updated by the admin',
  goals = 'Confirm the editable fields',
  type = 'event',
  status = 'active',
  starts_on = '2026-11-02',
  ends_on = '2026-12-01'
where organization_id = pg_temp.fixture('security.org_a')
  and project_id = pg_temp.fixture('security.project_spring')
  and name = 'Admin campaign';
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.slug = 'admin-campaign-' || substr(pg_temp.fixture('security.project_spring')::text, 1, 8)
      and campaign.name = 'Admin campaign updated'
      and campaign.description = 'Updated by the admin'
      and campaign.goals = 'Confirm the editable fields'
      and campaign.owner_id = pg_temp.fixture('security.admin_id')
      and campaign.type = 'event'
      and campaign.status = 'active'
      and campaign.starts_on = '2026-11-02'
      and campaign.ends_on = '2026-12-01'
      and campaign.archived_at is null
  ),
  1,
  'organization admin can update a disposable campaign without moving or archiving it'
);
select pg_temp.assert_sqlstate(
  format(
    'update public.campaigns set slug = %L where organization_id = %L and project_id = %L and name = %L',
    'renamed-admin-campaign',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'Admin campaign updated'
  ),
  '42501',
  'authenticated cannot update campaign slug'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.slug = 'admin-campaign-' || substr(pg_temp.fixture('security.project_spring')::text, 1, 8)
  ),
  1,
  'campaign slug update does not change the disposable slug'
);
select pg_temp.assert_sqlstate(
  format(
    'update public.campaigns set organization_id = %L where organization_id = %L and name = %L',
    pg_temp.fixture('security.org_b'),
    pg_temp.fixture('security.org_a'),
    'Admin campaign updated'
  ),
  '42501',
  'authenticated cannot update campaign organization_id'
);
select pg_temp.assert_sqlstate(
  format(
    'update public.campaigns set project_id = %L where organization_id = %L and name = %L',
    pg_temp.fixture('security.project_brand'),
    pg_temp.fixture('security.org_a'),
    'Admin campaign updated'
  ),
  '42501',
  'authenticated cannot update campaign project_id'
);
do $admin_cross_org_campaign$
declare
  affected_rows bigint := 0;
begin
  update public.campaigns
  set name = 'Cross organization campaign'
  where organization_id = pg_temp.fixture('security.org_b')
    and name = 'Admin campaign updated';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'organization admin cannot update a campaign through another organization'
  );
end
$admin_cross_org_campaign$;
select pg_temp.assert_sqlstate(
  format(
    'insert into public.campaigns (organization_id, project_id, slug, name, owner_id, type, starts_on, ends_on) values (%L, %L, %L, %L, %L, %L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'invalid-owner-campaign',
    'Invalid owner campaign',
    pg_temp.fixture('security.manager_id'),
    'content',
    '2026-11-01',
    '2026-11-30'
  ),
  'P0001',
  'campaign owner must already belong to the project'
);
select pg_temp.assert_eq(
  (select count(*) from public.campaigns where name = 'Invalid owner campaign'),
  0,
  'invalid campaign owner does not create a row'
);
select pg_temp.assert_sqlstate(
  format(
    'update public.campaigns set owner_id = %L where organization_id = %L and name = %L',
    pg_temp.fixture('security.manager_id'),
    pg_temp.fixture('security.org_a'),
    'Admin campaign updated'
  ),
  'P0001',
  'campaign owner update must already belong to the project'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.name = 'Admin campaign updated'
      and campaign.owner_id = pg_temp.fixture('security.admin_id')
  ),
  1,
  'invalid campaign owner update does not change the row'
);
select pg_temp.assert_sqlstate(
  format(
    'update public.campaigns set archived_at = timestamptz ''2026-11-10 10:00:00+00'' where organization_id = %L and project_id = %L and name = %L',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'Admin campaign updated'
  ),
  '42501',
  'authenticated cannot archive a campaign by updating archived_at'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.archived_at is null
  ),
  1,
  'failed campaign archive leaves the active row unchanged'
);
reset role;
update public.campaigns
set archived_at = timestamptz '2026-11-10 10:00:00+00'
where organization_id = pg_temp.fixture('security.org_a')
  and project_id = pg_temp.fixture('security.project_spring')
  and name = 'Admin campaign updated'
  and archived_at is null;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.archived_at = timestamptz '2026-11-10 10:00:00+00'
  ),
  1,
  'postgres can prepare an archived disposable campaign'
);
select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.archived_at = timestamptz '2026-11-10 10:00:00+00'
  ),
  1,
  'an authorized reader can select an archived campaign'
);
do $admin_update_archived_campaign$
declare
  affected_rows bigint := 0;
begin
  update public.campaigns
  set name = 'Archived campaign edit'
  where organization_id = pg_temp.fixture('security.org_a')
    and project_id = pg_temp.fixture('security.project_spring')
    and name = 'Admin campaign updated';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'authenticated cannot update an archived campaign'
  );
end
$admin_update_archived_campaign$;
do $admin_unarchive_campaign$
declare
  affected_rows bigint := 0;
begin
  update public.campaigns
  set archived_at = null
  where organization_id = pg_temp.fixture('security.org_a')
    and project_id = pg_temp.fixture('security.project_spring')
    and name = 'Admin campaign updated';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'authenticated cannot unarchive a campaign'
  );
end
$admin_unarchive_campaign$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.archived_at = timestamptz '2026-11-10 10:00:00+00'
  ),
  1,
  'archived campaign update and unarchive leave the row unchanged'
);
reset role;
update public.campaigns
set archived_at = null
where organization_id = pg_temp.fixture('security.org_a')
  and project_id = pg_temp.fixture('security.project_spring')
  and name = 'Admin campaign updated'
  and archived_at = timestamptz '2026-11-10 10:00:00+00';
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.archived_at is null
  ),
  1,
  'postgres can clear the disposable campaign archive'
);
select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
do $admin_edit_after_campaign_reactivated$
declare
  affected_rows bigint := 0;
begin
  update public.campaigns
  set description = 'Edited after the campaign was active again'
  where organization_id = pg_temp.fixture('security.org_a')
    and project_id = pg_temp.fixture('security.project_spring')
    and name = 'Admin campaign updated';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'authenticated can edit a campaign after its archive timestamp is cleared'
  );
end
$admin_edit_after_campaign_reactivated$;
update public.campaigns
set description = 'Updated by the admin'
where organization_id = pg_temp.fixture('security.org_a')
  and project_id = pg_temp.fixture('security.project_spring')
  and name = 'Admin campaign updated';
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.description = 'Updated by the admin'
      and campaign.archived_at is null
  ),
  1,
  'campaign edit after reactivation keeps the disposable campaign active'
);
reset role;

select pg_temp.assume_user(pg_temp.fixture('security.member_id'));
set local role authenticated;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.project_members as membership
    where membership.project_id = pg_temp.fixture('security.project_spring')
      and membership.profile_id = pg_temp.fixture('security.member_id')
      and membership.can_edit = false
      and membership.role <> 'viewer'
  ),
  1,
  'organization member has the disposable project membership without can_edit'
);
insert into public.campaigns (
  organization_id, project_id, slug, name, owner_id, type, status, starts_on, ends_on
)
values (
  pg_temp.fixture('security.org_a'),
  pg_temp.fixture('security.project_spring'),
  'member-campaign-' || substr(pg_temp.fixture('security.member_id')::text, 1, 8),
  'Member campaign',
  pg_temp.fixture('security.member_id'),
  'email',
  'active',
  '2026-11-01',
  '2026-11-30'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Member campaign'
      and campaign.owner_id = pg_temp.fixture('security.member_id')
      and campaign.archived_at is null
  ),
  1,
  'project member without can_edit can create a campaign'
);
update public.campaigns
set name = 'Member campaign updated', description = 'Updated without can_edit'
where organization_id = pg_temp.fixture('security.org_a')
  and project_id = pg_temp.fixture('security.project_spring')
  and name = 'Member campaign';
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.slug = 'member-campaign-' || substr(pg_temp.fixture('security.member_id')::text, 1, 8)
      and campaign.name = 'Member campaign updated'
      and campaign.description = 'Updated without can_edit'
      and campaign.owner_id = pg_temp.fixture('security.member_id')
      and campaign.archived_at is null
  ),
  1,
  'project member without can_edit can update a campaign'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.project_members as membership
    where membership.project_id = pg_temp.fixture('security.project_spring')
      and membership.profile_id = pg_temp.fixture('security.member_id')
      and membership.can_edit = false
  ),
  1,
  'campaign update leaves can_edit false'
);
insert into public.tasks (organization_id, project_id, title)
values (
  pg_temp.fixture('security.org_a'),
  pg_temp.fixture('security.project_spring'),
  'Member task'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.tasks as task
    where task.project_id = pg_temp.fixture('security.project_spring')
      and task.title = 'Member task'
      and task.description = ''
      and task.assignee_id is null
      and task.campaign_id is null
      and task.archived_at is null
  ),
  1,
  'project member without can_edit can insert a task'
);
do $member_update_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set description = 'Member edit'
  where project_id = pg_temp.fixture('security.project_spring')
    and title = 'Member task';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'project member without can_edit can update a task'
  );
end
$member_update_task$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.tasks as task
    where task.organization_id = pg_temp.fixture('security.org_a')
      and task.project_id = pg_temp.fixture('security.project_spring')
      and task.title = 'Member task'
      and task.description = 'Member edit'
      and task.campaign_id is null
  ),
  1,
  'member task update keeps the organization and project'
);
do $member_status_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set status = 'in_review'
  where project_id = pg_temp.fixture('security.project_spring')
    and title = 'Member task'
    and status = 'todo';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'project member without can_edit can update task status'
  );
end
$member_status_task$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.tasks as task
    where task.organization_id = pg_temp.fixture('security.org_a')
      and task.project_id = pg_temp.fixture('security.project_spring')
      and task.title = 'Member task'
      and task.description = 'Member edit'
      and task.status = 'in_review'
      and task.priority = 'medium'
      and task.assignee_id is null
      and task.campaign_id is null
      and task.due_on is null
      and task.archived_at is null
  ),
  1,
  'member status update keeps the other task fields'
);
do $member_restore_status$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set status = 'todo'
  where project_id = pg_temp.fixture('security.project_spring')
    and title = 'Member task'
    and status = 'in_review';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'member task status is restored before later checks'
  );
end
$member_restore_status$;
do $member_archive_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set archived_at = timestamptz '2026-11-08 12:00:00+00'
  where project_id = pg_temp.fixture('security.project_spring')
    and title = 'Member task'
    and archived_at is null;

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'project member without can_edit can archive a task'
  );
end
$member_archive_task$;
do $member_restore_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set archived_at = null
  where project_id = pg_temp.fixture('security.project_spring')
    and title = 'Member task'
    and archived_at is not null;

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'project member without can_edit can restore a task'
  );
end
$member_restore_task$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.tasks as task
    where task.organization_id = pg_temp.fixture('security.org_a')
      and task.project_id = pg_temp.fixture('security.project_spring')
      and task.title = 'Member task'
      and task.description = 'Member edit'
      and task.status = 'todo'
      and task.assignee_id is null
      and task.campaign_id is null
      and task.archived_at is null
  ),
  1,
  'member task archive and restore keep the other task fields'
);
select pg_temp.assert_eq(
  (
    with saved as (
      select pg_catalog.set_config('security.spring_updated_at', project.updated_at::text, true)
      from public.projects as project
      where project.id = pg_temp.fixture('security.project_spring')
        and project.description = ''
    )
    select count(*) from saved
  ),
  1,
  'disposable spring project baseline was recorded'
);
-- A false UPDATE USING policy skips the row and completes without 42501.
do $denied_project_update$
declare
  affected_rows bigint := 0;
begin
  update public.projects
  set description = 'unauthorized member edit'
  where id = pg_temp.fixture('security.project_spring');

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'organization member without can_edit cannot update the project'
  );
end
$denied_project_update$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.projects as project
    where project.id = pg_temp.fixture('security.project_spring')
      and project.description = ''
      and project.updated_at::text = pg_catalog.current_setting('security.spring_updated_at')
  ),
  1,
  'project description and updated_at stay unchanged when can_edit is false'
);
do $denied_project_archive$
declare
  affected_rows bigint := 0;
begin
  update public.projects
  set archived_at = timestamptz '2026-11-08 12:00:00+00'
  where id = pg_temp.fixture('security.project_spring');

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'organization member without can_edit cannot archive the project'
  );
end
$denied_project_archive$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.projects as project
    where project.id = pg_temp.fixture('security.project_spring')
      and project.archived_at is null
  ),
  1,
  'project archived_at stays empty when can_edit is false'
);
select pg_temp.assert_eq(
  (select count(*) from public.assets where id = pg_temp.fixture('security.asset_restricted')),
  0,
  'restricted asset is hidden from a project member who is not on the access list'
);
select pg_temp.assert_eq(
  (select count(*) from public.assets where id = pg_temp.fixture('security.asset_project')),
  1,
  'project member can read a project asset'
);
insert into public.asset_access (organization_id, asset_id, profile_id)
select
  pg_temp.fixture('security.org_a'),
  pg_temp.fixture('security.asset_member'),
  pg_temp.fixture('security.manager_id');
select pg_temp.assert_eq(
  (select count(*) from public.asset_access where asset_id = pg_temp.fixture('security.asset_member')),
  1,
  'organization member who owns an asset can grant access'
);
delete from public.asset_access where asset_id = pg_temp.fixture('security.asset_member');
select pg_temp.assert_eq(
  (select count(*) from public.asset_access where asset_id = pg_temp.fixture('security.asset_member')),
  0,
  'organization member who owns an asset can remove access'
);
insert into public.asset_project_links (organization_id, asset_id, project_id, linked_by)
select
  pg_temp.fixture('security.org_a'),
  pg_temp.fixture('security.asset_member'),
  pg_temp.fixture('security.project_spring'),
  pg_temp.fixture('security.member_id');
select pg_temp.assert_eq(
  (select count(*) from public.asset_project_links where asset_id = pg_temp.fixture('security.asset_member')),
  1,
  'organization member who owns an asset can link it to a project'
);
delete from public.asset_project_links where asset_id = pg_temp.fixture('security.asset_member');
select pg_temp.assert_eq(
  (select count(*) from public.asset_project_links where asset_id = pg_temp.fixture('security.asset_member')),
  0,
  'organization member who owns an asset can unlink it from a project'
);
insert into public.asset_campaign_links (organization_id, asset_id, campaign_id, linked_by)
select
  pg_temp.fixture('security.org_a'),
  pg_temp.fixture('security.asset_member'),
  pg_temp.fixture('security.campaign_spring'),
  pg_temp.fixture('security.member_id');
select pg_temp.assert_eq(
  (select count(*) from public.asset_campaign_links where asset_id = pg_temp.fixture('security.asset_member')),
  1,
  'organization member who owns an asset can link it to a campaign'
);
delete from public.asset_campaign_links where asset_id = pg_temp.fixture('security.asset_member');
select pg_temp.assert_eq(
  (select count(*) from public.asset_campaign_links where asset_id = pg_temp.fixture('security.asset_member')),
  0,
  'organization member who owns an asset can unlink it from a campaign'
);
select public.submit_deliverable(pg_temp.fixture('security.deliverable_id'));
select set_config('app.allow_status_change', 'on', true);
insert into public.deliverables (
  id, organization_id, project_id, campaign_id, title, type, creator_id, status
)
select
  pg_temp.fixture('security.deliverable_after'),
  pg_temp.fixture('security.org_a'),
  pg_temp.fixture('security.project_spring'),
  pg_temp.fixture('security.campaign_spring'),
  'Second forced approval',
  'document',
  pg_temp.fixture('security.member_id'),
  'approved';
select pg_temp.assert_eq(
  (select count(*) from public.deliverables where id = pg_temp.fixture('security.deliverable_after') and status = 'draft'),
  1,
  'a finished transition does not leave status changes open'
);
select pg_temp.assert_sqlstate(
  format(
    'select private.open_operation(%L, %L)',
    'deliverable_status',
    pg_temp.fixture('security.deliverable_id')
  ),
  '42501',
  'authenticated cannot open an operation guard'
);
select set_config('app.allow_activity', 'on', true);
select set_config('app.allow_notification', 'on', true);
select set_config('app.allow_approval', 'on', true);
select pg_temp.assert_sqlstate(
  format(
    'select public.review_deliverable(%L, %L, %L)',
    pg_temp.fixture('security.deliverable_id'),
    'approved',
    ''
  ),
  '42501',
  'creator without approval permission cannot approve'
);
select pg_temp.assert_sqlstate(
  format(
    'update public.deliverables set status = %L where id = %L',
    'approved',
    pg_temp.fixture('security.deliverable_id')
  ),
  '42501',
  'direct deliverable status update is rejected'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.activity_events (organization_id, actor_id, verb, summary, project_id) values (%L, %L, %L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.admin_id'),
    'created',
    'forged',
    pg_temp.fixture('security.project_spring')
  ),
  '42501',
  'client cannot insert activity for another actor'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.notifications (organization_id, recipient_id, title) values (%L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.admin_id'),
    'forged'
  ),
  '42501',
  'client cannot insert a notification'
);
reset role;

select pg_temp.assume_user(pg_temp.fixture('security.viewer_id'));
set local role authenticated;
select pg_temp.assert_eq(
  (select count(*) from public.assets where id = pg_temp.fixture('security.asset_viewer')),
  1,
  'organization viewer can read a company asset they own'
);
-- A false UPDATE USING policy skips the row and completes without 42501.
-- The data-modifying CTE returns one row per updated asset. Zero rows means
-- the name was not written. The following read fails if that name changed.
with updated as (
  update public.assets
  set name = 'Taken'
  where id = pg_temp.fixture('security.asset_viewer')
  returning id
)
select pg_temp.assert_eq(
  count(*),
  0,
  'organization viewer cannot manage an asset by ownership'
)
from updated;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.assets
    where id = pg_temp.fixture('security.asset_viewer')
      and name = 'Viewer original'
  ),
  1,
  'organization viewer cannot change an owned asset name'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.asset_comments (organization_id, asset_id, author_id, body) values (%L, %L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.asset_viewer'),
    pg_temp.fixture('security.viewer_id'),
    'note'
  ),
  '42501',
  'organization viewer cannot comment by ownership'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.asset_access (organization_id, asset_id, profile_id) values (%L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.asset_viewer'),
    pg_temp.fixture('security.manager_id')
  ),
  '42501',
  'organization viewer cannot grant access to an asset they own'
);
delete from public.asset_access where asset_id = pg_temp.fixture('security.asset_viewer');
select pg_temp.assert_eq(
  (select count(*) from public.asset_access where asset_id = pg_temp.fixture('security.asset_viewer')),
  1,
  'organization viewer cannot remove access from an asset they own'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.asset_project_links (organization_id, asset_id, project_id, linked_by) values (%L, %L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.asset_viewer'),
    pg_temp.fixture('security.project_brand'),
    pg_temp.fixture('security.viewer_id')
  ),
  '42501',
  'organization viewer cannot link an owned asset to a project'
);
delete from public.asset_project_links where asset_id = pg_temp.fixture('security.asset_viewer');
select pg_temp.assert_eq(
  (select count(*) from public.asset_project_links where asset_id = pg_temp.fixture('security.asset_viewer')),
  1,
  'organization viewer cannot unlink an owned asset from a project'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.asset_campaign_links (organization_id, asset_id, campaign_id, linked_by) values (%L, %L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.asset_viewer'),
    pg_temp.fixture('security.campaign_brand'),
    pg_temp.fixture('security.viewer_id')
  ),
  '42501',
  'organization viewer cannot link an owned asset to a campaign'
);
delete from public.asset_campaign_links where asset_id = pg_temp.fixture('security.asset_viewer');
select pg_temp.assert_eq(
  (select count(*) from public.asset_campaign_links where asset_id = pg_temp.fixture('security.asset_viewer')),
  1,
  'organization viewer cannot unlink an owned asset from a campaign'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.tasks (organization_id, project_id, title) values (%L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'Viewer task'
  ),
  '42501',
  'project viewer cannot create a task'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.campaigns (organization_id, project_id, slug, name, owner_id, type, starts_on, ends_on) values (%L, %L, %L, %L, %L, %L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'viewer-campaign',
    'Viewer campaign',
    pg_temp.fixture('security.admin_id'),
    'content',
    '2026-11-01',
    '2026-11-30'
  ),
  '42501',
  'project viewer cannot create a campaign'
);
select pg_temp.assert_eq(
  (select count(*) from public.campaigns where name = 'Viewer campaign'),
  0,
  'viewer campaign insert does not create a row'
);
do $viewer_update_campaign$
declare
  affected_rows bigint := 0;
begin
  update public.campaigns
  set name = 'Viewer campaign edit'
  where organization_id = pg_temp.fixture('security.org_a')
    and name = 'Admin campaign updated';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'project viewer cannot update a campaign'
  );
end
$viewer_update_campaign$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.name = 'Admin campaign updated'
  ),
  1,
  'viewer campaign update leaves the campaign unchanged'
);
select pg_temp.assert_sqlstate(
  format(
    'update public.campaigns set slug = %L where organization_id = %L and project_id = %L and name = %L',
    'renamed-admin-campaign',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'Admin campaign updated'
  ),
  '42501',
  'project viewer cannot update campaign slug'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.slug = 'admin-campaign-' || substr(pg_temp.fixture('security.project_spring')::text, 1, 8)
  ),
  1,
  'viewer slug update leaves the disposable slug unchanged'
);
do $viewer_update_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set title = 'Viewer took the task'
  where project_id = pg_temp.fixture('security.project_spring')
    and assignee_id = pg_temp.fixture('security.viewer_id');

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'assigned project viewer cannot update a task'
  );
end
$viewer_update_task$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.tasks as task
    where task.organization_id = pg_temp.fixture('security.org_a')
      and task.project_id = pg_temp.fixture('security.project_spring')
      and task.title = 'Viewer assigned task'
      and task.assignee_id = pg_temp.fixture('security.viewer_id')
      and task.status = 'todo'
  ),
  1,
  'assigned viewer update leaves the task unchanged'
);
do $viewer_archive_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set archived_at = timestamptz '2026-11-08 12:00:00+00'
  where project_id = pg_temp.fixture('security.project_spring')
    and assignee_id = pg_temp.fixture('security.viewer_id')
    and archived_at is null;

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'assigned project viewer cannot archive a task'
  );
end
$viewer_archive_task$;
do $viewer_restore_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set archived_at = null
  where project_id = pg_temp.fixture('security.project_spring')
    and assignee_id = pg_temp.fixture('security.viewer_id');

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'assigned project viewer cannot restore a task'
  );
end
$viewer_restore_task$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.tasks as task
    where task.organization_id = pg_temp.fixture('security.org_a')
      and task.project_id = pg_temp.fixture('security.project_spring')
      and task.title = 'Viewer assigned task'
      and task.assignee_id = pg_temp.fixture('security.viewer_id')
      and task.status = 'todo'
      and task.campaign_id is null
      and task.archived_at is null
  ),
  1,
  'assigned viewer archive attempt leaves archived_at empty'
);
reset role;

select pg_temp.assume_user(pg_temp.fixture('security.outsider_id'));
set local role authenticated;
do $outsider_update_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set title = 'Outsider edit'
  where project_id = pg_temp.fixture('security.project_spring')
    and title = 'Admin task updated';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
  'organization outsider cannot update a task'
);
end
$outsider_update_task$;
do $outsider_archive_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set archived_at = timestamptz '2026-11-08 12:00:00+00'
  where project_id = pg_temp.fixture('security.project_spring')
    and title = 'Admin task updated'
    and archived_at is null;

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'organization outsider cannot archive a task'
  );
end
$outsider_archive_task$;
do $outsider_restore_task$
declare
  affected_rows bigint := 0;
begin
  update public.tasks
  set archived_at = null
  where project_id = pg_temp.fixture('security.project_spring')
    and title = 'Admin task updated';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'organization outsider cannot restore a task'
  );
end
$outsider_restore_task$;
do $outsider_update_campaign$
declare
  affected_rows bigint := 0;
begin
  update public.campaigns
  set name = 'Outsider campaign edit'
  where organization_id = pg_temp.fixture('security.org_a')
    and name = 'Admin campaign updated';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'organization outsider cannot update a campaign'
  );
end
$outsider_update_campaign$;
select pg_temp.assert_sqlstate(
  format(
    'update public.campaigns set slug = %L where organization_id = %L and project_id = %L and name = %L',
    'renamed-admin-campaign',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'Admin campaign updated'
  ),
  '42501',
  'organization outsider cannot update campaign slug'
);
reset role;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.slug = 'admin-campaign-' || substr(pg_temp.fixture('security.project_spring')::text, 1, 8)
  ),
  1,
  'outsider slug update leaves the disposable slug unchanged'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.archived_at is null
  ),
  1,
  'outsider campaign update leaves the campaign unchanged'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.tasks as task
    where task.organization_id = pg_temp.fixture('security.org_a')
      and task.project_id = pg_temp.fixture('security.project_spring')
      and task.title = 'Admin task updated'
      and task.status = 'in_progress'
      and task.assignee_id is null
      and task.campaign_id is null
      and task.archived_at is null
  ),
  1,
  'outsider update leaves the task organization and project unchanged'
);

select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
select public.review_deliverable(pg_temp.fixture('security.deliverable_id'), 'approved', 'Ready');
select pg_temp.assert_eq(
  (
    select count(*)
    from public.approval_requests
    where deliverable_id = pg_temp.fixture('security.deliverable_id')
      and actor_id = pg_temp.fixture('security.admin_id')
      and to_status = 'approved'
  ),
  1,
  'approval actor is the signed-in reviewer'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.notifications as notice
    where notice.recipient_id = pg_temp.fixture('security.admin_id')
      and notice.title like 'approved %'
      and notice.activity_event_id in (
        select event.id
        from public.activity_events as event
        where event.deliverable_id = pg_temp.fixture('security.deliverable_id')
      )
  ),
  0,
  'the actor is not notified about their own action'
);
reset role;

-- notifications_select shows a row only to its recipient. The member has to
-- read their own inbox; the reviewing admin cannot see that row.
select pg_temp.assume_user(pg_temp.fixture('security.member_id'));
set local role authenticated;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.notifications as notice
    where notice.recipient_id = pg_temp.fixture('security.member_id')
      and notice.title like 'approved %'
      and notice.activity_event_id in (
        select event.id
        from public.activity_events as event
        where event.deliverable_id = pg_temp.fixture('security.deliverable_id')
      )
  ),
  1,
  'the other project member receives the approval notification'
);
reset role;

select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
select pg_temp.assert_sqlstate(
  format(
    'select public.review_deliverable(%L, %L, %L)',
    pg_temp.fixture('security.deliverable_id'),
    'changes_requested',
    'Again'
  ),
  'P0001',
  'a second review is rejected'
);
reset role;

-- These three checks run as the session user. The guard trigger must reject
-- them after the review function has returned, without a missing-grant error.
select pg_temp.assert_sqlstate(
  format(
    'update public.deliverables set status = %L where id = %L',
    'draft',
    pg_temp.fixture('security.deliverable_id')
  ),
  '42501',
  'a finished review does not leave status changes open'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.approval_requests (organization_id, deliverable_id, project_id, action, from_status, to_status, actor_id) values (%L, %L, %L, %L, %L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.deliverable_id'),
    pg_temp.fixture('security.project_spring'),
    'approve',
    'submitted',
    'approved',
    pg_temp.fixture('security.admin_id')
  ),
  '42501',
  'a finished review does not leave approval writes open'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.notifications (organization_id, recipient_id, activity_event_id, title) select %L, %L, event.id, %L from public.activity_events as event where event.deliverable_id = %L limit 1',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.member_id'),
    'forged',
    pg_temp.fixture('security.deliverable_id')
  ),
  '42501',
  'a finished review does not leave notification writes open'
);

select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
do $admin_archive_project$
declare
  affected_rows bigint := 0;
begin
  update public.projects
  set archived_at = timestamptz '2026-11-08 12:00:00+00'
  where id = pg_temp.fixture('security.project_spring');

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'organization admin can archive the disposable project'
  );
end
$admin_archive_project$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.projects as project
    where project.id = pg_temp.fixture('security.project_spring')
      and project.archived_at = timestamptz '2026-11-08 12:00:00+00'
  ),
  1,
  'disposable project archived_at stores the archive time'
);
do $admin_update_campaign_on_archived_project$
declare
  affected_rows bigint := 0;
begin
  update public.campaigns
  set name = 'Campaign on archived project'
  where organization_id = pg_temp.fixture('security.org_a')
    and project_id = pg_temp.fixture('security.project_spring')
    and name = 'Admin campaign updated';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    0,
    'authenticated cannot update a campaign while its project is archived'
  );
end
$admin_update_campaign_on_archived_project$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.archived_at is null
  ),
  1,
  'campaign on an archived project keeps its name'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.campaigns (organization_id, project_id, slug, name, owner_id, type, status, starts_on, ends_on) values (%L, %L, %L, %L, %L, %L, %L, %L, %L)',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'archived-parent-campaign',
    'Campaign inserted under archived project',
    pg_temp.fixture('security.admin_id'),
    'content',
    'planning',
    '2026-11-01',
    '2026-11-30'
  ),
  '42501',
  'authenticated cannot insert a campaign while its project is archived'
);
select pg_temp.assert_eq(
  (select count(*) from public.campaigns where name = 'Campaign inserted under archived project'),
  0,
  'insert under an archived project does not create a row'
);
do $admin_restore_project$
declare
  affected_rows bigint := 0;
begin
  update public.projects
  set archived_at = null
  where id = pg_temp.fixture('security.project_spring');

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'organization admin can restore the disposable project'
  );
end
$admin_restore_project$;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.projects as project
    where project.id = pg_temp.fixture('security.project_spring')
      and project.archived_at is null
  ),
  1,
  'disposable project archived_at is empty after restore'
);
do $admin_edit_campaign_after_project_restore$
declare
  affected_rows bigint := 0;
begin
  update public.campaigns
  set description = 'Edited after the project restore'
  where organization_id = pg_temp.fixture('security.org_a')
    and project_id = pg_temp.fixture('security.project_spring')
    and name = 'Admin campaign updated';

  get diagnostics affected_rows = row_count;

  perform pg_temp.assert_eq(
    affected_rows,
    1,
    'authenticated can edit a campaign after its project is restored'
  );
end
$admin_edit_campaign_after_project_restore$;
update public.campaigns
set description = 'Updated by the admin'
where organization_id = pg_temp.fixture('security.org_a')
  and project_id = pg_temp.fixture('security.project_spring')
  and name = 'Admin campaign updated';
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.project_id = pg_temp.fixture('security.project_spring')
      and campaign.name = 'Admin campaign updated'
      and campaign.description = 'Updated by the admin'
      and campaign.archived_at is null
  ),
  1,
  'campaign edit after project restore returns the disposable description'
);
update public.project_members
set can_approve_deliverables = true
where project_id = pg_temp.fixture('security.project_spring')
  and profile_id = pg_temp.fixture('security.member_id');
select pg_temp.assert_eq(
  (
    select count(*)
    from public.project_members
    where project_id = pg_temp.fixture('security.project_spring')
      and profile_id = pg_temp.fixture('security.member_id')
      and can_approve_deliverables
  ),
  1,
  'an organization admin can grant deliverable approval'
);
reset role;

-- Campaign archive RPCs. Requires 20261110140000_campaign_archive_functions.sql.
-- Disposable rows only. now() does not move inside this transaction, so a repeated
-- call is judged by ctid: a second UPDATE would create a new row version.
create or replace function pg_temp.assert_text(actual text, expected text, message text)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if actual is distinct from expected then
    raise exception '% (expected %, got %)', message, expected, actual;
  end if;
end;
$$;

create or replace function pg_temp.assert_error(
  statement text,
  expected_state text,
  expected_message text,
  message text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  observed_state text;
  observed_message text;
begin
  begin
    execute statement;
  exception
    when others then
      observed_state := sqlstate;
      observed_message := sqlerrm;
  end;

  if observed_state is null then
    raise exception '% did not fail', message;
  elsif observed_state is distinct from expected_state then
    raise exception '% failed with % instead of %', message, observed_state, expected_state;
  elsif observed_message is distinct from expected_message then
    raise exception '% failed with message % instead of %', message, observed_message, expected_message;
  end if;
end;
$$;

create or replace function pg_temp.assert_permission_denied(statement text, message text)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  observed_state text;
  observed_message text;
begin
  begin
    execute statement;
  exception
    when others then
      observed_state := sqlstate;
      observed_message := sqlerrm;
  end;

  if observed_state is null then
    raise exception '% did not fail', message;
  elsif observed_state is distinct from '42501' then
    raise exception '% failed with % instead of 42501', message, observed_state;
  elsif observed_message not like 'permission denied for function%' then
    raise exception '% failed with message %', message, observed_message;
  end if;
end;
$$;

grant execute on function pg_temp.assert_text(text, text, text) to anon, authenticated;
grant execute on function pg_temp.assert_error(text, text, text, text) to anon, authenticated;
grant execute on function pg_temp.assert_permission_denied(text, text) to anon, authenticated;

do $archive_campaign_fixture$
declare
  v_campaign uuid := gen_random_uuid();
begin
  insert into public.campaigns (
    id, organization_id, project_id, slug, name, description, goals,
    owner_id, type, status, starts_on, ends_on
  )
  values (
    v_campaign,
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'archive-rpc-' || pg_catalog.current_setting('security.suffix'),
    'Archive rpc campaign',
    'Disposable archive description',
    'Disposable archive goals',
    pg_temp.fixture('security.admin_id'),
    'content',
    'planning',
    date '2026-11-01',
    date '2026-11-30'
  );

  perform pg_catalog.set_config('security.archive_campaign', v_campaign::text, true);
end
$archive_campaign_fixture$;

alter table public.campaigns disable trigger campaigns_touch_updated_at;
update public.campaigns
set updated_at = timestamptz '2020-01-01 00:00:00+00'
where id = pg_temp.fixture('security.archive_campaign');
alter table public.campaigns enable trigger campaigns_touch_updated_at;
select pg_temp.assert_eq(
  (
    select count(*)
    from pg_catalog.pg_trigger as campaign_trigger
    where campaign_trigger.tgname = 'campaigns_touch_updated_at'
      and campaign_trigger.tgenabled = 'O'
  ),
  1,
  'campaign updated_at trigger is enabled before archive calls'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.id = pg_temp.fixture('security.archive_campaign')
      and campaign.updated_at = timestamptz '2020-01-01 00:00:00+00'
      and campaign.archived_at is null
  ),
  1,
  'disposable archive campaign starts active with a sentinel updated_at'
);

select pg_temp.assert_eq(
  (
    select count(*)
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'private'
      and proc.proname = 'set_campaign_archived'
      and proc.prosecdef
  ),
  1,
  'set_campaign_archived is security definer'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'archive_campaign'
      and proc.prosecdef
  ),
  1,
  'archive_campaign is security definer'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'unarchive_campaign'
      and proc.prosecdef
  ),
  1,
  'unarchive_campaign is security definer'
);
select pg_temp.assert_eq(
  (select case when pg_catalog.has_function_privilege('authenticated', 'public.archive_campaign(uuid, uuid)', 'EXECUTE') then 1 else 0 end),
  1,
  'authenticated can execute archive_campaign'
);
select pg_temp.assert_eq(
  (select case when pg_catalog.has_function_privilege('authenticated', 'public.unarchive_campaign(uuid, uuid)', 'EXECUTE') then 1 else 0 end),
  1,
  'authenticated can execute unarchive_campaign'
);
select pg_temp.assert_eq(
  (select case when pg_catalog.has_function_privilege('authenticated', 'private.set_campaign_archived(uuid, uuid, boolean)', 'EXECUTE') then 1 else 0 end),
  0,
  'authenticated cannot execute set_campaign_archived'
);
select pg_temp.assert_eq(
  (select case when pg_catalog.has_function_privilege('anon', 'public.archive_campaign(uuid, uuid)', 'EXECUTE') then 1 else 0 end),
  0,
  'anon cannot execute archive_campaign'
);
select pg_temp.assert_eq(
  (select case when pg_catalog.has_function_privilege('anon', 'public.unarchive_campaign(uuid, uuid)', 'EXECUTE') then 1 else 0 end),
  0,
  'anon cannot execute unarchive_campaign'
);
select pg_temp.assert_eq(
  (select case when pg_catalog.has_function_privilege('anon', 'private.set_campaign_archived(uuid, uuid, boolean)', 'EXECUTE') then 1 else 0 end),
  0,
  'anon cannot execute set_campaign_archived'
);
select pg_temp.assert_eq(
  (select case when pg_catalog.has_function_privilege('public', 'public.archive_campaign(uuid, uuid)', 'EXECUTE') then 1 else 0 end),
  0,
  'public cannot execute archive_campaign'
);
select pg_temp.assert_eq(
  (select case when pg_catalog.has_function_privilege('public', 'public.unarchive_campaign(uuid, uuid)', 'EXECUTE') then 1 else 0 end),
  0,
  'public cannot execute unarchive_campaign'
);
select pg_temp.assert_eq(
  (select case when pg_catalog.has_function_privilege('public', 'private.set_campaign_archived(uuid, uuid, boolean)', 'EXECUTE') then 1 else 0 end),
  0,
  'public cannot execute set_campaign_archived'
);
select pg_temp.assert_error(
  format(
    'select private.set_campaign_archived(%L::uuid, %L::uuid, null)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  '22023',
  'archive flag is required',
  'a null archive flag is rejected before a write'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from information_schema.column_privileges as granted
    where granted.grantee = 'authenticated'
      and granted.table_schema = 'public'
      and granted.table_name = 'campaigns'
      and granted.column_name = 'slug'
      and granted.privilege_type = 'UPDATE'
  ),
  0,
  'authenticated still has no campaign slug update privilege'
);
select pg_temp.assert_eq(
  (
    select case when count(*) > 0 then 1 else 0 end
    from information_schema.column_privileges as granted
    where granted.grantee = 'authenticated'
      and granted.table_schema = 'public'
      and granted.table_name = 'campaigns'
      and granted.column_name = 'archived_at'
      and granted.privilege_type = 'UPDATE'
  ),
  0,
  'authenticated cannot update campaigns.archived_at directly'
);

set local role anon;
select pg_temp.assert_permission_denied(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'anon cannot call archive_campaign'
);
select pg_temp.assert_permission_denied(
  format(
    'select public.unarchive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'anon cannot call unarchive_campaign'
);
select pg_temp.assert_error(
  format(
    'select private.set_campaign_archived(%L::uuid, %L::uuid, true)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  '42501',
  'permission denied for schema private',
  'anon cannot call set_campaign_archived'
);
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select pg_temp.assert_eq(
  (select case when auth.uid() is null then 1 else 0 end),
  1,
  'cleared jwt settings leave auth.uid() null'
);
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  '42501',
  'sign in is required',
  'authenticated without auth.uid() cannot archive'
);
select pg_temp.assert_error(
  format(
    'select public.unarchive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  '42501',
  'sign in is required',
  'authenticated without auth.uid() cannot restore'
);
reset role;

select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
select pg_temp.assert_permission_denied(
  format(
    'select private.set_campaign_archived(%L::uuid, %L::uuid, true)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'authenticated cannot call set_campaign_archived to archive'
);
select pg_temp.assert_permission_denied(
  format(
    'select private.set_campaign_archived(%L::uuid, %L::uuid, false)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'authenticated cannot call set_campaign_archived to restore'
);
do $admin_archive_campaign_rpc$
declare
  result text;
  prior_ctid tid;
  prior_created timestamptz;
  activity_before bigint;
begin
  select campaign.ctid, campaign.created_at
  into prior_ctid, prior_created
  from public.campaigns as campaign
  where campaign.id = pg_temp.fixture('security.archive_campaign');
  select count(*)
  into activity_before
  from public.activity_events as activity
  where activity.campaign_id = pg_temp.fixture('security.archive_campaign');

  result := public.archive_campaign(
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  );
  perform pg_temp.assert_text(result, 'archived', 'organization admin can archive a disposable campaign');
  perform pg_temp.assert_eq(
    (
      select count(*)
      from public.campaigns as campaign
      where campaign.id = pg_temp.fixture('security.archive_campaign')
        and campaign.ctid is distinct from prior_ctid
        and campaign.organization_id = pg_temp.fixture('security.org_a')
        and campaign.project_id = pg_temp.fixture('security.project_spring')
        and campaign.slug = 'archive-rpc-' || pg_catalog.current_setting('security.suffix')
        and campaign.name = 'Archive rpc campaign'
        and campaign.description = 'Disposable archive description'
        and campaign.goals = 'Disposable archive goals'
        and campaign.owner_id = pg_temp.fixture('security.admin_id')
        and campaign.type = 'content'
        and campaign.status = 'planning'
        and campaign.starts_on = date '2026-11-01'
        and campaign.ends_on = date '2026-11-30'
        and campaign.created_at is not distinct from prior_created
        and campaign.archived_at is not null
        and campaign.updated_at <> timestamptz '2020-01-01 00:00:00+00'
    ),
    1,
    'archive changes archived_at and the updated_at trigger only'
  );
  perform pg_temp.assert_eq(
    (
      select count(*)
      from public.activity_events as activity
      where activity.campaign_id = pg_temp.fixture('security.archive_campaign')
    ),
    activity_before,
    'archive does not write an activity event'
  );
end
$admin_archive_campaign_rpc$;
do $admin_repeat_archive_campaign_rpc$
declare
  result text;
  prior_ctid tid;
  prior_archived timestamptz;
  prior_updated timestamptz;
begin
  select campaign.ctid, campaign.archived_at, campaign.updated_at
  into prior_ctid, prior_archived, prior_updated
  from public.campaigns as campaign
  where campaign.id = pg_temp.fixture('security.archive_campaign');

  result := public.archive_campaign(
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  );
  perform pg_temp.assert_text(result, 'already_archived', 'repeated archive reports already_archived');
  perform pg_temp.assert_eq(
    (
      select count(*)
      from public.campaigns as campaign
      where campaign.id = pg_temp.fixture('security.archive_campaign')
        and campaign.ctid = prior_ctid
        and campaign.archived_at = prior_archived
        and campaign.updated_at = prior_updated
    ),
    1,
    'repeated archive preserves archived_at and updated_at'
  );
  perform pg_catalog.set_config('security.archive_ctid', prior_ctid::text, true);
  perform pg_catalog.set_config('security.archive_archived_at', prior_archived::text, true);
  perform pg_catalog.set_config('security.archive_updated_at', prior_updated::text, true);
end
$admin_repeat_archive_campaign_rpc$;
reset role;
update public.projects
set archived_at = timestamptz '2026-11-10 12:00:00+00'
where id = pg_temp.fixture('security.project_spring');
select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'P0001',
  'Restore this project before archiving or restoring this campaign',
  'archived parent blocks a repeated archive'
);
select pg_temp.assert_error(
  format(
    'select public.unarchive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'P0001',
  'Restore this project before archiving or restoring this campaign',
  'archived parent blocks restore'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.id = pg_temp.fixture('security.archive_campaign')
      and campaign.ctid = pg_catalog.current_setting('security.archive_ctid')::tid
      and campaign.archived_at = pg_catalog.current_setting('security.archive_archived_at')::timestamptz
      and campaign.updated_at = pg_catalog.current_setting('security.archive_updated_at')::timestamptz
  ),
  1,
  'archived parent leaves the campaign row unchanged'
);
reset role;
update public.projects
set archived_at = null
where id = pg_temp.fixture('security.project_spring');
select pg_temp.assert_eq(
  (
    select count(*)
    from public.projects as project
    where project.id = pg_temp.fixture('security.project_spring')
      and project.archived_at is null
  ),
  1,
  'disposable project is active before campaign restore'
);
select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
do $admin_restore_campaign_rpc$
declare
  result text;
  prior_ctid tid;
  prior_created timestamptz;
begin
  select campaign.ctid, campaign.created_at
  into prior_ctid, prior_created
  from public.campaigns as campaign
  where campaign.id = pg_temp.fixture('security.archive_campaign');

  result := public.unarchive_campaign(
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  );
  perform pg_temp.assert_text(result, 'restored', 'organization admin can restore a disposable campaign');
  perform pg_temp.assert_eq(
    (
      select count(*)
      from public.campaigns as campaign
      where campaign.id = pg_temp.fixture('security.archive_campaign')
        and campaign.ctid is distinct from prior_ctid
        and campaign.organization_id = pg_temp.fixture('security.org_a')
        and campaign.project_id = pg_temp.fixture('security.project_spring')
        and campaign.slug = 'archive-rpc-' || pg_catalog.current_setting('security.suffix')
        and campaign.name = 'Archive rpc campaign'
        and campaign.description = 'Disposable archive description'
        and campaign.goals = 'Disposable archive goals'
        and campaign.owner_id = pg_temp.fixture('security.admin_id')
        and campaign.type = 'content'
        and campaign.status = 'planning'
        and campaign.starts_on = date '2026-11-01'
        and campaign.ends_on = date '2026-11-30'
        and campaign.created_at is not distinct from prior_created
        and campaign.archived_at is null
    ),
    1,
    'restore clears archived_at and leaves the other campaign fields unchanged'
  );
end
$admin_restore_campaign_rpc$;
do $admin_repeat_restore_campaign_rpc$
declare
  result text;
  prior_ctid tid;
  prior_updated timestamptz;
begin
  select campaign.ctid, campaign.updated_at
  into prior_ctid, prior_updated
  from public.campaigns as campaign
  where campaign.id = pg_temp.fixture('security.archive_campaign');

  result := public.unarchive_campaign(
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  );
  perform pg_temp.assert_text(result, 'already_active', 'repeated restore reports already_active');
  perform pg_temp.assert_eq(
    (
      select count(*)
      from public.campaigns as campaign
      where campaign.id = pg_temp.fixture('security.archive_campaign')
        and campaign.ctid = prior_ctid
        and campaign.archived_at is null
        and campaign.updated_at = prior_updated
    ),
    1,
    'repeated restore preserves updated_at'
  );
end
$admin_repeat_restore_campaign_rpc$;
select pg_temp.assert_sqlstate(
  format(
    'update public.campaigns set archived_at = timestamptz ''2026-11-10 10:00:00+00'' where id = %L',
    pg_temp.fixture('security.archive_campaign')
  ),
  '42501',
  'authenticated still cannot archive by updating archived_at'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.id = pg_temp.fixture('security.archive_campaign')
      and campaign.archived_at is null
  ),
  1,
  'direct archived_at update leaves the disposable campaign active'
);
select pg_temp.assert_sqlstate(
  format(
    'update public.campaigns set slug = %L where id = %L',
    'renamed-archive-rpc',
    pg_temp.fixture('security.archive_campaign')
  ),
  '42501',
  'authenticated still cannot update campaign slug'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.id = pg_temp.fixture('security.archive_campaign')
      and campaign.slug = 'archive-rpc-' || pg_catalog.current_setting('security.suffix')
  ),
  1,
  'slug update leaves the disposable archive slug unchanged'
);
select pg_temp.assert_sqlstate(
  format(
    'insert into public.campaigns (organization_id, project_id, slug, name, owner_id, type, status, starts_on, ends_on, archived_at) values (%L, %L, %L, %L, %L, %L, %L, %L, %L, timestamptz ''2026-11-10 10:00:00+00'')',
    pg_temp.fixture('security.org_a'),
    pg_temp.fixture('security.project_spring'),
    'archived-insert-rpc-' || pg_catalog.current_setting('security.suffix'),
    'Archived insert rpc campaign',
    pg_temp.fixture('security.admin_id'),
    'content',
    'planning',
    '2026-11-01',
    '2026-11-30'
  ),
  '42501',
  'authenticated still cannot insert an archived campaign'
);
select pg_temp.assert_eq(
  (select count(*) from public.campaigns where name = 'Archived insert rpc campaign'),
  0,
  'archived campaign insert does not create a row'
);
select pg_temp.assert_error(
  format(
    'update public.campaigns set owner_id = %L where id = %L',
    pg_temp.fixture('security.manager_id'),
    pg_temp.fixture('security.archive_campaign')
  ),
  'P0001',
  'campaign owner must be a member of the project',
  'an unrelated campaign P0001 keeps its own message'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.id = pg_temp.fixture('security.archive_campaign')
      and campaign.owner_id = pg_temp.fixture('security.admin_id')
  ),
  1,
  'unrelated owner failure leaves the disposable owner unchanged'
);
reset role;

select pg_temp.assume_user(pg_temp.fixture('security.member_id'));
set local role authenticated;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.project_members as membership
    join public.organization_memberships as organization_membership
      on organization_membership.organization_id = membership.organization_id
     and organization_membership.profile_id = membership.profile_id
    where membership.project_id = pg_temp.fixture('security.project_spring')
      and membership.profile_id = pg_temp.fixture('security.member_id')
      and membership.role <> 'viewer'
      and membership.can_edit = false
      and organization_membership.role = 'member'
  ),
  1,
  'archive member is a non-viewer project member with can_edit false'
);
do $member_archive_campaign_rpc$
declare
  result text;
  prior_ctid tid;
begin
  select campaign.ctid
  into prior_ctid
  from public.campaigns as campaign
  where campaign.id = pg_temp.fixture('security.archive_campaign');

  result := public.archive_campaign(
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  );
  perform pg_temp.assert_text(
    result,
    'archived',
    'project member with can_edit false can archive a disposable campaign'
  );
  perform pg_temp.assert_eq(
    (
      select count(*)
      from public.campaigns as campaign
      where campaign.id = pg_temp.fixture('security.archive_campaign')
        and campaign.ctid is distinct from prior_ctid
        and campaign.slug = 'archive-rpc-' || pg_catalog.current_setting('security.suffix')
        and campaign.name = 'Archive rpc campaign'
        and campaign.description = 'Disposable archive description'
        and campaign.goals = 'Disposable archive goals'
        and campaign.owner_id = pg_temp.fixture('security.admin_id')
        and campaign.project_id = pg_temp.fixture('security.project_spring')
        and campaign.organization_id = pg_temp.fixture('security.org_a')
        and campaign.archived_at is not null
    ),
    1,
    'member archive keeps the disposable campaign fields'
  );
end
$member_archive_campaign_rpc$;
do $member_repeat_archive_campaign_rpc$
declare
  result text;
  prior_ctid tid;
  prior_archived timestamptz;
  prior_updated timestamptz;
begin
  select campaign.ctid, campaign.archived_at, campaign.updated_at
  into prior_ctid, prior_archived, prior_updated
  from public.campaigns as campaign
  where campaign.id = pg_temp.fixture('security.archive_campaign');

  result := public.archive_campaign(
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  );
  perform pg_temp.assert_text(result, 'already_archived', 'member repeated archive reports already_archived');
  perform pg_temp.assert_eq(
    (
      select count(*)
      from public.campaigns as campaign
      where campaign.id = pg_temp.fixture('security.archive_campaign')
        and campaign.ctid = prior_ctid
        and campaign.archived_at = prior_archived
        and campaign.updated_at = prior_updated
    ),
    1,
    'member repeated archive preserves archived_at and updated_at'
  );
end
$member_repeat_archive_campaign_rpc$;
do $member_restore_campaign_rpc$
declare
  result text;
  prior_ctid tid;
begin
  select campaign.ctid
  into prior_ctid
  from public.campaigns as campaign
  where campaign.id = pg_temp.fixture('security.archive_campaign');

  result := public.unarchive_campaign(
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  );
  perform pg_temp.assert_text(
    result,
    'restored',
    'project member with can_edit false can restore a disposable campaign'
  );
  perform pg_temp.assert_eq(
    (
      select count(*)
      from public.campaigns as campaign
      where campaign.id = pg_temp.fixture('security.archive_campaign')
        and campaign.ctid is distinct from prior_ctid
        and campaign.archived_at is null
        and campaign.owner_id = pg_temp.fixture('security.admin_id')
    ),
    1,
    'member restore clears archived_at'
  );
end
$member_restore_campaign_rpc$;
do $member_repeat_restore_campaign_rpc$
declare
  result text;
  prior_ctid tid;
  prior_updated timestamptz;
begin
  select campaign.ctid, campaign.updated_at
  into prior_ctid, prior_updated
  from public.campaigns as campaign
  where campaign.id = pg_temp.fixture('security.archive_campaign');

  result := public.unarchive_campaign(
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  );
  perform pg_temp.assert_text(result, 'already_active', 'member repeated restore reports already_active');
  perform pg_temp.assert_eq(
    (
      select count(*)
      from public.campaigns as campaign
      where campaign.id = pg_temp.fixture('security.archive_campaign')
        and campaign.ctid = prior_ctid
        and campaign.archived_at is null
        and campaign.updated_at = prior_updated
    ),
    1,
    'member repeated restore preserves updated_at'
  );
  perform pg_catalog.set_config('security.archive_active_ctid', prior_ctid::text, true);
  perform pg_catalog.set_config('security.archive_active_updated_at', prior_updated::text, true);
end
$member_repeat_restore_campaign_rpc$;
reset role;
update public.projects
set archived_at = timestamptz '2026-11-10 12:30:00+00'
where id = pg_temp.fixture('security.project_spring');
select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'P0001',
  'Restore this project before archiving or restoring this campaign',
  'archived parent blocks archive of an active campaign'
);
select pg_temp.assert_error(
  format(
    'select public.unarchive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'P0001',
  'Restore this project before archiving or restoring this campaign',
  'archived parent blocks restore of an active campaign'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.id = pg_temp.fixture('security.archive_campaign')
      and campaign.ctid = pg_catalog.current_setting('security.archive_active_ctid')::tid
      and campaign.archived_at is null
      and campaign.updated_at = pg_catalog.current_setting('security.archive_active_updated_at')::timestamptz
  ),
  1,
  'archived parent does not archive or restore an active campaign'
);
reset role;
update public.projects
set archived_at = null
where id = pg_temp.fixture('security.project_spring');

select pg_temp.assume_user(pg_temp.fixture('security.viewer_id'));
set local role authenticated;
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  '42501',
  'not allowed to archive or restore this campaign',
  'organization and project viewer cannot archive'
);
select pg_temp.assert_error(
  format(
    'select public.unarchive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  '42501',
  'not allowed to archive or restore this campaign',
  'organization and project viewer cannot restore'
);
reset role;
update public.organization_memberships
set role = 'member'
where organization_id = pg_temp.fixture('security.org_a')
  and profile_id = pg_temp.fixture('security.viewer_id');
select pg_temp.assume_user(pg_temp.fixture('security.viewer_id'));
set local role authenticated;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.project_members as membership
    join public.organization_memberships as organization_membership
      on organization_membership.organization_id = membership.organization_id
     and organization_membership.profile_id = membership.profile_id
    where membership.project_id = pg_temp.fixture('security.project_spring')
      and membership.profile_id = pg_temp.fixture('security.viewer_id')
      and membership.role = 'viewer'
      and organization_membership.role = 'member'
  ),
  1,
  'project viewer denial is separate from the organization role'
);
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  '42501',
  'not allowed to archive or restore this campaign',
  'project viewer cannot archive'
);
select pg_temp.assert_error(
  format(
    'select public.unarchive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  '42501',
  'not allowed to archive or restore this campaign',
  'project viewer cannot restore'
);
reset role;
update public.organization_memberships
set role = 'viewer'
where organization_id = pg_temp.fixture('security.org_a')
  and profile_id = pg_temp.fixture('security.viewer_id');
update public.project_members
set role = 'project_member'
where project_id = pg_temp.fixture('security.project_spring')
  and profile_id = pg_temp.fixture('security.viewer_id');
select pg_temp.assume_user(pg_temp.fixture('security.viewer_id'));
set local role authenticated;
select pg_temp.assert_eq(
  (
    select count(*)
    from public.project_members as membership
    join public.organization_memberships as organization_membership
      on organization_membership.organization_id = membership.organization_id
     and organization_membership.profile_id = membership.profile_id
    where membership.project_id = pg_temp.fixture('security.project_spring')
      and membership.profile_id = pg_temp.fixture('security.viewer_id')
      and membership.role = 'project_member'
      and membership.can_edit = false
      and organization_membership.role = 'viewer'
  ),
  1,
  'organization viewer denial keeps can_edit false on a non-viewer project role'
);
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  '42501',
  'not allowed to archive or restore this campaign',
  'organization viewer cannot archive'
);
select pg_temp.assert_error(
  format(
    'select public.unarchive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  '42501',
  'not allowed to archive or restore this campaign',
  'organization viewer cannot restore'
);
reset role;
update public.project_members
set role = 'viewer'
where project_id = pg_temp.fixture('security.project_spring')
  and profile_id = pg_temp.fixture('security.viewer_id');
delete from public.project_members
where project_id = pg_temp.fixture('security.project_spring')
  and profile_id = pg_temp.fixture('security.viewer_id');
select pg_temp.assume_user(pg_temp.fixture('security.viewer_id'));
set local role authenticated;
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'P0002',
  'Campaign not found',
  'organization viewer outside the project cannot archive'
);
select pg_temp.assert_error(
  format(
    'select public.unarchive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'P0002',
  'Campaign not found',
  'organization viewer outside the project cannot restore'
);
reset role;
insert into public.project_members (
  organization_id, project_id, profile_id, role, can_comment
)
values (
  pg_temp.fixture('security.org_a'),
  pg_temp.fixture('security.project_spring'),
  pg_temp.fixture('security.viewer_id'),
  'viewer',
  true
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.project_members as membership
    join public.organization_memberships as organization_membership
      on organization_membership.organization_id = membership.organization_id
     and organization_membership.profile_id = membership.profile_id
    where membership.project_id = pg_temp.fixture('security.project_spring')
      and membership.profile_id = pg_temp.fixture('security.viewer_id')
      and membership.role = 'viewer'
      and organization_membership.role = 'viewer'
  ),
  1,
  'disposable viewer membership is restored'
);

select pg_temp.assume_user(pg_temp.fixture('security.outsider_id'));
set local role authenticated;
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'P0002',
  'Campaign not found',
  'outsider cannot archive with the real organization id'
);
select pg_temp.assert_error(
  format(
    'select public.unarchive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'P0002',
  'Campaign not found',
  'outsider cannot restore with the real organization id'
);
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_b')
  ),
  'P0002',
  'Campaign not found',
  'outsider organization mismatch cannot archive'
);
reset role;
select pg_temp.assume_user(pg_temp.fixture('security.manager_id'));
set local role authenticated;
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'P0002',
  'Campaign not found',
  'organization member outside the project cannot archive'
);
select pg_temp.assert_error(
  format(
    'select public.unarchive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_a')
  ),
  'P0002',
  'Campaign not found',
  'organization member outside the project cannot restore'
);
reset role;
select pg_temp.assume_user(pg_temp.fixture('security.admin_id'));
set local role authenticated;
select pg_temp.assert_error(
  'select public.archive_campaign(null, null)',
  'P0002',
  'Campaign not found',
  'null campaign and organization ids cannot archive'
);
select pg_temp.assert_error(
  'select public.unarchive_campaign(null, null)',
  'P0002',
  'Campaign not found',
  'null campaign and organization ids cannot restore'
);
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(null, %L::uuid)',
    pg_temp.fixture('security.org_a')
  ),
  'P0002',
  'Campaign not found',
  'null campaign id cannot archive'
);
select pg_temp.assert_error(
  format(
    'select public.unarchive_campaign(%L::uuid, null)',
    pg_temp.fixture('security.archive_campaign')
  ),
  'P0002',
  'Campaign not found',
  'null organization id cannot restore'
);
select pg_temp.assert_error(
  format(
    'select public.archive_campaign(%L::uuid, %L::uuid)',
    pg_catalog.gen_random_uuid(),
    pg_temp.fixture('security.org_a')
  ),
  'P0002',
  'Campaign not found',
  'missing campaign id cannot archive'
);
select pg_temp.assert_error(
  format(
    'select public.unarchive_campaign(%L::uuid, %L::uuid)',
    pg_temp.fixture('security.archive_campaign'),
    pg_temp.fixture('security.org_b')
  ),
  'P0002',
  'Campaign not found',
  'organization admin cannot restore through the other organization'
);
select pg_temp.assert_eq(
  (
    select count(*)
    from public.campaigns as campaign
    where campaign.id = pg_temp.fixture('security.archive_campaign')
      and campaign.organization_id = pg_temp.fixture('security.org_a')
      and campaign.archived_at is null
      and campaign.slug = 'archive-rpc-' || pg_catalog.current_setting('security.suffix')
      and campaign.owner_id = pg_temp.fixture('security.admin_id')
  ),
  1,
  'denied archive calls leave the disposable campaign active'
);
reset role;
select 'ALL SECURITY TESTS PASSED' as test_result;
rollback;
