-- SEC-01: Preserve at least one org_admin per existing organization.
-- STATUS: DESIGN DRAFT - NOT READY FOR DEPLOYMENT.
-- Prevent removal or demotion of the last org_admin.
-- Cover direct deletes and cascades from profiles/auth.users.
-- Allow authorized deletion of the entire organization.
-- TODO: Implement concurrency-safe trigger and cascade handling.
-- DO NOT DEPLOY until local tests and security review pass.

-- SECURITY: Revoke direct EXECUTE on the trigger function from PUBLIC.
-- SECURITY: Use a fixed empty search_path and schema-qualified references.

-- DESIGN: Organization deletion is reserved for a future authorized Platform Admin operation.
-- DESIGN: Do not grant organization DELETE privileges to org_admin, member, or viewer.
-- DESIGN: Do not expose service_role credentials to client-side code.

-- SEC-01: Organization existence helper (DRAFT; cascade behavior unverified).
create or replace function private.sec01_organization_exists(p_organization_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.organizations o
    where o.id = p_organization_id
  );
$function$;

revoke all on function private.sec01_organization_exists(uuid) from public, anon, authenticated;

-- SEC-01 SECURITY REVIEW: This helper checks visibility only.
-- It does NOT authorize organization deletion or bypass the last-admin guard.
-- Do not use it as a standalone cascade exception.
-- Next: design concurrency-safe membership protection and authorized deletion flow.

-- SEC-01: Transaction-scoped serialization helper (DESIGN DRAFT).
-- All admin-removal paths must acquire this lock before checking membership.
create or replace function private.sec01_lock_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text, 73001)
  );
end;
$function$;

revoke all on function private.sec01_lock_organization(uuid) from public, anon, authenticated;

-- SEC-01: Last-admin protection trigger (INCOMPLETE DRAFT).
create or replace function private.preserve_last_org_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if TG_OP = 'DELETE' and OLD.role = 'org_admin' then
    perform private.sec01_lock_organization(OLD.organization_id);
    if private.sec01_organization_exists(OLD.organization_id) and not exists (
      select 1 from public.organization_memberships m
      where m.organization_id = OLD.organization_id
        and m.role = 'org_admin'
        and m.id <> OLD.id
    ) then
      raise exception 'Cannot delete the last org_admin from an organization';
    end if;
    return OLD;
  end if;
  if TG_OP = 'UPDATE' and OLD.role = 'org_admin' and (NEW.role <> 'org_admin' or NEW.organization_id is distinct from OLD.organization_id) then
    perform private.sec01_lock_organization(OLD.organization_id);
    if not exists (
      select 1 from public.organization_memberships m
      where m.organization_id = OLD.organization_id
        and m.role = 'org_admin'
        and m.id <> OLD.id
    ) then
      raise exception 'Cannot remove the last org_admin from an organization';
    end if;
  end if;
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$function$;

revoke all on function private.preserve_last_org_admin() from public, anon, authenticated;

-- SEC-01 BLOCKER: Concurrency safety is not yet verified.
-- Advisory locking alone does not establish correctness for every transaction isolation level.
-- Validate concurrent admin demotions/deletions and organization cascades before attaching the trigger.

-- SEC-01: Trigger attachment (LOCAL TEST DRAFT ONLY).
-- NOT APPROVED FOR DEPLOYMENT.
create trigger sec01_preserve_last_org_admin
before update or delete on public.organization_memberships
for each row
execute function private.preserve_last_org_admin();


-- LOCAL TEST ONLY - DO NOT DEPLOY
begin;
do $test$
begin
  begin
    update public.organization_memberships
    set role = 'member'
    where organization_id = '5ec0b001-0000-4000-8000-000000000002'::uuid
      and role = 'org_admin';
    raise exception 'SEC01 TEST FAILED: last admin demotion was allowed';
  exception
    when raise_exception then
      if SQLERRM = 'Cannot remove the last org_admin from an organization' then
        raise notice 'SEC01 TEST PASSED: last admin demotion blocked';
      else
        raise;
      end if;
  end;
end;
$test$;
rollback;
