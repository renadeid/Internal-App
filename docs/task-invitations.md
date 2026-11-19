# Task selection and status-only invitations

Apply `20261119190000_invitation_tasks_and_status.sql` after the previous migrations.

In Project access, a Super admin selects a recipient and Assigned tasks only. The new permission selector offers View only (default) or View and update task status. Organisation Viewers remain read-only. Existing members can receive or lose the status permission through Save member access.

For new invitees, select up to 100 active tasks. Only unassigned tasks or tasks already assigned to that recipient are selectable. The UI lists the first 1,000 active project tasks. Existing assignments to other employees must be changed explicitly first. A pending invite grants no access and makes no assignment. Acceptance grants membership and assigns the chosen tasks in one transaction. If a selected task is deleted, archived, moved or assigned to someone else while pending, acceptance fails without partial membership or assignment; the Super admin must correct and resend.

The recipient sees selected task titles and the status permission before accepting. After acceptance, assigned-only visibility continues to follow current task assignments: tasks later assigned to that person are also visible, and reassignment removes visibility. Selection is an initial assignment, not a permanent allowlist.

Status-only permission allows changing the status of the recipient's own active tasks in an active project. It does not grant task creation, detail editing, reassignment, archival, deletion, campaigns, project history or permission management. The authenticated SQL RPC verifies the caller, organisation, membership, explicit flag and task assignee. Direct task updates remain denied by the existing RLS policies.

All existing memberships and invitations default to View only. Existing pending invitations can be updated with the new options by selecting the same recipient and pressing Invite to project again. No live permissions or task assignments are changed by applying the migration alone.
