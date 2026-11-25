/**
 * Public tables the server is allowed to query.
 * These columns match supabase/migrations/20261104170000_schema.sql.
 */
export type Database = {
  public: {
    Tables: {
      asset_folders:{Row:{id:string;organization_id:string;name:string;visibility:"company"|"project_members";project_id:string|null;created_by:string|null;created_at:string};Insert:never;Update:never;Relationships:[]}
      activity_events: {Row:{id:string;organization_id:string;actor_id:string|null;verb:string;summary:string;project_id:string|null;campaign_id:string|null;task_id:string|null;deliverable_id:string|null;asset_id:string|null;created_at:string};Insert:never;Update:never;Relationships:[]}
      notifications: {Row:{id:string;organization_id:string;recipient_id:string;activity_event_id:string|null;title:string;read_at:string|null;created_at:string};Insert:never;Update:{read_at?:string|null};Relationships:[]}

      project_invitations: {
        Row: { id: string; organization_id: string; project_id: string; profile_id: string; created_at: string; history_access: "full_history" | "assigned_only"; can_update_assigned_status: boolean; task_ids: string[] }
        Insert: { organization_id: string; project_id: string; profile_id: string; history_access?: "full_history" | "assigned_only" }
        Update: { id?: string }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
        }
        Relationships: []
      }
      organization_memberships: {
        Row: {
          id: string
          organization_id: string
          profile_id: string
          role: Database["public"]["Enums"]["org_role"]
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          profile_id: string
          role: Database["public"]["Enums"]["org_role"]
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          job_title: string | null
          avatar_color: string | null
          initials: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          email: string
          job_title?: string | null
          avatar_color?: string | null
          initials?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          job_title?: string | null
          avatar_color?: string | null
          initials?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      department_memberships: {
        Row: {
          organization_id: string
          department_id: string
          profile_id: string
          role: Database["public"]["Enums"]["department_role"]
          created_at: string
        }
        Insert: {
          organization_id: string
          department_id: string
          profile_id: string
          role: Database["public"]["Enums"]["department_role"]
          created_at?: string
        }
        Update: {
          organization_id?: string
          department_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["department_role"]
          created_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          id: string
          organization_id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          slug?: string
          created_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          profile_id: string
          role: Database["public"]["Enums"]["project_role"]
          history_access: "full_history" | "assigned_only"
          can_update_assigned_status: boolean
          can_edit: boolean
          can_manage_members: boolean
          can_approve_deliverables: boolean
          can_manage_assets: boolean
          can_comment: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          profile_id: string
          role: Database["public"]["Enums"]["project_role"]
          history_access?: "full_history" | "assigned_only"
          can_update_assigned_status?: boolean
          can_edit?: boolean
          can_manage_members?: boolean
          can_approve_deliverables?: boolean
          can_manage_assets?: boolean
          can_comment?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          history_access?: "full_history" | "assigned_only"
          can_update_assigned_status?: boolean
          can_edit?: boolean
          can_manage_members?: boolean
          can_approve_deliverables?: boolean
          can_manage_assets?: boolean
          can_comment?: boolean
          created_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          organization_id: string
          slug: string
          name: string
          description: string
          lead_department_id: string
          status: Database["public"]["Enums"]["project_status"]
          owner_id: string
          starts_on: string | null
          due_on: string | null
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          slug: string
          name: string
          description?: string
          lead_department_id: string
          status?: Database["public"]["Enums"]["project_status"]
          owner_id: string
          starts_on?: string | null
          due_on?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          slug?: string
          name?: string
          description?: string
          lead_department_id?: string
          status?: Database["public"]["Enums"]["project_status"]
          owner_id?: string
          starts_on?: string | null
          due_on?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          slug: string
          name: string
          description: string
          goals: string
          owner_id: string
          type: Database["public"]["Enums"]["campaign_type"]
          status: Database["public"]["Enums"]["campaign_status"]
          starts_on: string
          ends_on: string
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          slug: string
          name: string
          description?: string
          goals?: string
          owner_id: string
          type: Database["public"]["Enums"]["campaign_type"]
          status?: Database["public"]["Enums"]["campaign_status"]
          starts_on: string
          ends_on: string
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          slug?: string
          name?: string
          description?: string
          goals?: string
          owner_id?: string
          type?: Database["public"]["Enums"]["campaign_type"]
          status?: Database["public"]["Enums"]["campaign_status"]
          starts_on?: string
          ends_on?: string
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          campaign_id: string | null
          title: string
          description: string
          assignee_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          due_on: string | null
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          campaign_id?: string | null
          title: string
          description?: string
          assignee_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          due_on?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          campaign_id?: string | null
          title?: string
          description?: string
          assignee_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          due_on?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_asset_folder:{Args:{target_organization:string;folder_name:string;folder_project?:string|null};Returns:string}
      move_asset_to_folder:{Args:{target_asset:string;target_folder:string|null};Returns:undefined}
      shared_asset_upload_access: { Args: {target_organization:string}; Returns:unknown }
      list_shared_assets: { Args: {target_organization:string}; Returns:unknown }
      edit_shared_asset: { Args: {target_asset:string;details:Record<string,unknown>}; Returns:undefined }
      delete_shared_asset: { Args: {target_asset:string;confirmation_name:string}; Returns:unknown }
      shared_asset_file: { Args: {target_asset:string;target_version?:string}; Returns:unknown }
      admin_invite_project_tasks: { Args: { target_organization: string; target_project: string; target_profile: string; target_history_access: string; selected_tasks: string[]; allow_status_update: boolean }; Returns: undefined }
      set_assigned_task_status: { Args: { target_organization: string; target_project: string; target_task: string; next_status: Database["public"]["Enums"]["task_status"] }; Returns: boolean }
      my_project_task_invitations: { Args: { target_organization: string }; Returns: { id: string; can_update_assigned_status: boolean; task_titles: string[] }[] }
      create_viewer_link: { Args: { target_organization: string; target_resource: string; resource_kind: string; link_token: string; asset_snapshot?: Record<string, unknown> }; Returns: string }
      read_viewer_link: { Args: { link_token: string }; Returns: unknown }
      manage_viewer_links: { Args: { target_organization: string; target_resource: string; resource_kind: string; revoke_id?: string }; Returns: { id: string; created_at: string; expires_at: string }[] }
      admin_delete_project: { Args: { target_organization: string; target_project: string; confirmation_name: string }; Returns: boolean }
      my_project_invitations: { Args: { target_organization: string }; Returns: { id: string; project_id: string; project_name: string; history_access: "full_history" | "assigned_only"; can_update_assigned_status: boolean; task_ids: string[] }[] }
      admin_invite_project_member: { Args: { target_organization: string; target_project: string; target_profile: string; target_history_access?: string }; Returns: undefined }
      admin_create_project: { Args: { payload: Record<string, unknown> }; Returns: string }
      accept_project_invitation: { Args: { invitation_id: string }; Returns: string }
      admin_add_member: { Args: { target_organization: string; member_email: string }; Returns: undefined }
    }
    Enums: {
      org_role: "org_admin" | "admin" | "team_lead" | "member" | "viewer"
      department_role: "manager" | "member"
      project_role: "project_manager" | "project_member" | "viewer"
      project_status: "planning" | "in_progress" | "in_review" | "on_hold"
      campaign_type: "social_media" | "email" | "paid_ads" | "content" | "event" | "other"
      campaign_status: "planning" | "active" | "on_hold" | "completed"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "in_review" | "done"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
