-- Campaign Owner RLS Security Migration
-- STATUS: DRAFT - NOT APPROVED FOR DEPLOYMENT
--
-- Purpose:
-- Allow the campaign owner validation trigger to check project membership
-- under FORCE ROW LEVEL SECURITY using a dedicated least-privilege role.
--
-- Based on the locally tested campaign-owner-rls-migration.sql.
--
-- Deployment prerequisites:
-- 1. Verify CREATE ROLE privileges in the target Supabase environment.
-- 2. Verify ALTER FUNCTION OWNER privileges.
-- 3. Review role grants, RLS policies, and SECURITY DEFINER ownership.
-- 4. Test on a disposable database before any cloud deployment.
--
-- Contains executable SQL statements; DRAFT ONLY. Do not apply.

-- ============================================================
-- SECTION 1: Dedicated validator role
-- REVIEW REQUIRED: CREATE ROLE privileges on Supabase Cloud.
-- ============================================================

BEGIN;

CREATE ROLE campaign_owner_validator
  NOLOGIN
  NOSUPERUSER
  NOBYPASSRLS
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT;

-- ============================================================
-- SECTION 2: Minimum validator read permissions
-- REVIEW REQUIRED: Role and schema grant compatibility.
-- ============================================================

GRANT USAGE ON SCHEMA public TO campaign_owner_validator;
GRANT USAGE ON SCHEMA private TO campaign_owner_validator;

GRANT SELECT (project_id, profile_id, organization_id)
ON public.project_members TO campaign_owner_validator;

CREATE POLICY project_members_campaign_owner_validation
ON public.project_members
AS PERMISSIVE
FOR SELECT TO campaign_owner_validator
USING (true);

-- ============================================================
-- SECTION 3: Secure trigger function ownership
-- REVIEW REQUIRED: Supabase role ownership compatibility.
-- ============================================================

-- Temporary membership allows the migration executor to
-- transfer function ownership to the validator role.
GRANT campaign_owner_validator TO postgres
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;

-- Required temporarily for function ownership transfer.
GRANT CREATE ON SCHEMA private TO campaign_owner_validator;

REVOKE ALL ON FUNCTION private.enforce_campaign_owner()
FROM PUBLIC;

ALTER FUNCTION private.enforce_campaign_owner()
OWNER TO campaign_owner_validator;

ALTER FUNCTION private.enforce_campaign_owner()
SECURITY DEFINER;

ALTER FUNCTION private.enforce_campaign_owner()
SET search_path TO '';

-- Remove temporary privileges and membership.

REVOKE CREATE ON SCHEMA private FROM campaign_owner_validator;

REVOKE campaign_owner_validator FROM postgres;

COMMIT;
