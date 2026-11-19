
-- Global Super Admin Authorization Integration
-- STATUS: DRAFT - NOT EXECUTED
-- TARGET: Local test database only
-- Prerequisite: global_super_admin.sql
-- Requires security review before execution.

-- 1. Organization administrator
CREATE OR REPLACE FUNCTION private.is_org_admin(
    target_organization uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.organizations organization
        WHERE organization.id = target_organization
          AND (
              (SELECT private.is_super_admin())
              OR EXISTS (
                  SELECT 1
                  FROM public.organization_memberships membership
                  WHERE membership.organization_id = organization.id
                    AND membership.profile_id = (SELECT auth.uid())
                    AND membership.role = 'org_admin'
              )
          )
    );
$function$;


-- 2. Organization membership
CREATE OR REPLACE FUNCTION private.is_org_member(
    target_organization uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.organizations organization
        WHERE organization.id = target_organization
          AND (
              (SELECT private.is_super_admin())
              OR EXISTS (
                  SELECT 1
                  FROM public.organization_memberships membership
                  WHERE membership.organization_id = organization.id
                    AND membership.profile_id = (SELECT auth.uid())
              )
          )
    );
$function$;


-- 3. Department manager
CREATE OR REPLACE FUNCTION private.is_department_manager(
    target_organization uuid,
    target_department uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.departments department
        WHERE department.id = target_department
          AND department.organization_id = target_organization
          AND (
              (SELECT private.is_super_admin())
              OR EXISTS (
                  SELECT 1
                  FROM public.department_memberships membership
                  JOIN public.organization_memberships org_membership
                    ON org_membership.organization_id =
                       membership.organization_id
                   AND org_membership.profile_id =
                       membership.profile_id
                  WHERE membership.organization_id =
                        target_organization
                    AND membership.department_id =
                        target_department
                    AND membership.profile_id =
                        (SELECT auth.uid())
                    AND membership.role = 'manager'
                    AND org_membership.role <> 'viewer'
              )
          )
    );
$function$;


-- 4. Read projects
CREATE OR REPLACE FUNCTION private.can_read_project(
    target_project uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.projects project
        WHERE project.id = target_project
          AND (
              (SELECT private.is_super_admin())
              OR private.is_org_admin(project.organization_id)
              OR EXISTS (
                  SELECT 1
                  FROM public.project_members member
                  WHERE member.project_id = project.id
                    AND member.profile_id = (SELECT auth.uid())
              )
          )
    );
$function$;


-- 5. Write projects
CREATE OR REPLACE FUNCTION private.can_write_project(
    target_project uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.projects project
        WHERE project.id = target_project
          AND (
              (SELECT private.is_super_admin())
              OR private.is_org_admin(project.organization_id)
              OR EXISTS (
                  SELECT 1
                  FROM public.project_members member
                  JOIN public.organization_memberships membership
                    ON membership.organization_id =
                       member.organization_id
                   AND membership.profile_id =
                       member.profile_id
                  WHERE member.project_id = project.id
                    AND member.profile_id = (SELECT auth.uid())
                    AND member.role <> 'viewer'
                    AND membership.role <> 'viewer'
              )
          )
    );
$function$;


-- 6. Project permission flags
CREATE OR REPLACE FUNCTION private.project_flag(
    target_project uuid,
    flag_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT
        flag_name IN (
            'edit',
            'manage_members',
            'approve_deliverables',
            'manage_assets',
            'comment'
        )
        AND EXISTS (
            SELECT 1
            FROM public.projects project
            WHERE project.id = target_project
              AND (
                  (SELECT private.is_super_admin())

                  OR EXISTS (
                      SELECT 1
                      FROM public.project_members member
                      JOIN public.organization_memberships membership
                        ON membership.organization_id =
                           member.organization_id
                       AND membership.profile_id =
                           member.profile_id
                      WHERE member.project_id = project.id
                        AND member.profile_id = (SELECT auth.uid())
                        AND member.role <> 'viewer'
                        AND membership.role <> 'viewer'
                        AND CASE flag_name
                            WHEN 'edit'
                                THEN member.can_edit
                            WHEN 'manage_members'
                                THEN member.can_manage_members
                            WHEN 'approve_deliverables'
                                THEN member.can_approve_deliverables
                            WHEN 'manage_assets'
                                THEN member.can_manage_assets
                            WHEN 'comment'
                                THEN member.can_comment
                            ELSE false
                        END
                  )

                  OR (
                      flag_name IN (
                          'edit',
                          'manage_members',
                          'manage_assets',
                          'comment'
                      )
                      AND private.is_org_admin(
                          project.organization_id
                      )
                  )
              )
        );
$function$;
