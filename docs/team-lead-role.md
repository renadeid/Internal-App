# Owner (Team lead)

Organization role value: `team_lead`. Super admin assigns it in Settings → Organization members.

Team leads can create, edit and assign tasks within projects where they have full-history, non-viewer membership. They can select any organization member who already belongs to that project, regardless of department. Assignment grants no additional project access; a Super admin must grant access or send an invitation that the recipient accepts first.

Assigned-tasks-only membership does not allow task management. Projects without membership remain private. Team leads cannot archive, restore or delete tasks, delete projects, invite members or change organization roles. Other existing project permissions continue to follow their explicit membership flags.

Apply `20261119160000_team_lead_role_value.sql` and commit it first, then apply `20261119160100_team_lead_permissions.sql` in a separate SQL Editor run. No existing users are automatically reassigned.
