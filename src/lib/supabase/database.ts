/**
 * Public tables the server is allowed to query.
 * These columns match supabase/migrations/20261104170000_schema.sql.
 */
export type Database = {
  public: {
    Tables: {
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
      [_ in never]: never
    }
    Enums: {
      org_role: "org_admin" | "member" | "viewer"
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
