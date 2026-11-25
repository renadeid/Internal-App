export type WorkspaceArtifact = {
  id: string
  title: string
  category: "Access & roles" | "Project delivery" | "Sharing & files"
  kind: "Reference" | "Checklist"
  summary: string
  href: "/settings" | "/projects" | "/assets"
  action: string
  sections: { title: string; items: string[] }[]
}

export const workspaceArtifacts: WorkspaceArtifact[] = [
  {
    id: "roles-and-permissions", title: "Roles & permissions", category: "Access & roles", kind: "Reference",
    summary: "A single reference for Super admin, Admin, Owner (Team lead), members and external viewers.", href: "/settings", action: "Manage organisation roles",
    sections: [
      { title: "Organisation roles", items: ["Super admin manages members, departments, roles and project access within their organisation. They can create and permanently delete projects and create public viewer links.", "Admin can view and edit existing organisation work. Creating, deleting, archiving, restoring and permission management are unavailable.", "Owner (Team lead) can create, edit and assign tasks inside projects where they have full-history, non-viewer membership. They cannot archive or delete tasks.", "Member access follows project membership and the permissions explicitly granted. Full history and assigned tasks only are separate visibility options."] },
      { title: "Viewers", items: ["An internal Viewer signs in and remains read-only.", "An external viewer needs no account. A public link exposes only the selected shared snapshot, without access to the rest of the workspace.", "Owning an asset or project does not automatically change a person's organisation role."] },
    ],
  },
  {
    id: "project-access-plan", title: "Project access plan", category: "Access & roles", kind: "Checklist",
    summary: "Decide who can enter a project and how much work they can see.", href: "/projects", action: "Open projects",
    sections: [
      { title: "Before creating a project", items: ["Choose the project name, lead department and owner.", "Choose selected members, the lead department, current organisation employees, custom permissions or invitations.", "Choose Full project history or Assigned tasks only. Visibility does not automatically grant editing rights."] },
      { title: "After creating a project", items: ["Review the saved members and permissions in Project access.", "Grant new employees access explicitly. Department and organisation selections include employees present at project creation; later employees are not added automatically.", "For an existing project member, use Save member access. To invite them again, remove their membership first.", "Check the member's own account to confirm the intended visibility."] },
    ],
  },
  {
    id: "task-invitation-handoff", title: "Task invitation & handoff", category: "Project delivery", kind: "Checklist",
    summary: "Invite a colleague to selected tasks with view-only or status-update access.", href: "/projects", action: "Open a project",
    sections: [
      { title: "Prepare the invitation", items: ["Select an organisation member who does not already belong to the project.", "Choose Assigned tasks only, then View only or View and update task status. Organisation Viewers remain read-only.", "Select active tasks that are unassigned or already assigned to that person. Tasks assigned to another employee must be reassigned separately first.", "Send Invite to project. A pending invitation grants no project access and makes no new task assignments."] },
      { title: "Accept and work", items: ["The recipient reviews the invitation in the application and accepts it. Email invitations are not connected.", "Acceptance grants the selected access and assigns the selected tasks together. If a task has become unavailable or assigned to someone else, ask the Super admin to correct and resend the invitation.", "With the explicit status permission, the recipient can update the status of their own active tasks. Task detail editing, reassignment, archival and deletion remain unavailable.", "Assigned-only visibility follows current assignments, including tasks assigned later. Removing project membership removes project access."] },
    ],
  },
  {
    id: "external-sharing-guide", title: "External sharing handover", category: "Sharing & files", kind: "Reference",
    summary: "What public viewers receive, how long links last and how to stop access.", href: "/projects", action: "Choose a project to share",
    sections: [
      { title: "What the link includes", items: ["Super admins can create a public view-only link from a project or asset detail page.", "Project links contain a snapshot of the overview and current active task titles, descriptions, statuses and due dates. Member identities, comments, campaigns and assets are excluded.", "Asset links contain the selected asset name, description, type and source URL. The source file keeps its own permissions."] },
      { title: "Before handing over", items: ["Review all included text before creating the link. Anyone who has the link can open it without signing in.", "Use Copy link and check the Link copied confirmation. Links expire after 7 days.", "Use a publicly deployed app address when sharing with another device. Localhost links only work on the same computer.", "Use Revoke link to stop future access. Revocation cannot retract copies or source URLs already obtained.", "Shared pages are snapshots. Later updates require a new link."] },
    ],
  },
  {
    id: "asset-library-handover", title: "Asset library handover", category: "Sharing & files", kind: "Checklist",
    summary: "Prepare a useful asset record and check the file can be reached and downloaded.", href: "/assets", action: "Open assets library",
    sections: [
      { title: "Prepare the record", items: ["Add a descriptive name, type, collection and tags.", "Add the file or external URL and check it points to the intended source.", "Associate the record with the relevant project or campaign where appropriate."] },
      { title: "Check the handover", items: ["Use Download for a direct file URL. If the host blocks downloading or requires authentication, open the source and download there.", "Records without a file URL cannot be downloaded. External webpage links open at their source.", "Assets Library stores shared files privately in Supabase. Company files are available to organization members; project files require full project access. Download links check access and expire shortly after issue.", "Keep original files in a source with the intended sharing permissions."] },
    ],
  },
  {
    id: "workspace-review-checklist", title: "Workspace review checklist", category: "Project delivery", kind: "Checklist",
    summary: "The step-by-step review plan for the Roaya Connect features we configured.", href: "/projects", action: "Continue in projects",
    sections: [
      { title: "Access and assignments", items: ["Check Super admin controls in Settings.", "Create a test project with selected members, then create tasks assigned to different people.", "Compare Full project history with Assigned tasks only from the member's own account.", "Remove membership and confirm the project becomes unavailable.", "Send a selected-task invitation, accept it, and confirm the chosen tasks and status permission.", "Change a task's status and verify the saved change from the Super admin account."] },
      { title: "Role and delivery checks", items: ["Check that Admin can edit existing work but cannot create, archive or delete.", "Check that Owner (Team lead) can assign tasks only in accessible projects and only to existing project members.", "Test an asset download from a valid source URL.", "Open a public viewer link without signing in, then revoke it and verify access stops.", "Archive and restore a test project. Use a disposable test project to check permanent deletion.", "This is a review checklist, not a record that every check has passed. Confirm each outcome in the workspace."] },
    ],
  },
]

export function artifactMarkdown(artifact: WorkspaceArtifact) {
  return [`# ${artifact.title}`, artifact.summary, ...artifact.sections.map(section => `## ${section.title}\n\n${section.items.map(item => artifact.kind === "Checklist" ? `- [ ] ${item}` : `- ${item}`).join("\n")}`)].join("\n\n") + "\n"
}
