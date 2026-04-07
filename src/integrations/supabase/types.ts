export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          performed_by: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      client_benchmarks: {
        Row: {
          churn_avg: number | null
          ebitda_avg: number | null
          id: string
          nps_avg: number | null
          updated_at: string
        }
        Insert: {
          churn_avg?: number | null
          ebitda_avg?: number | null
          id?: string
          nps_avg?: number | null
          updated_at?: string
        }
        Update: {
          churn_avg?: number | null
          ebitda_avg?: number | null
          id?: string
          nps_avg?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      client_kpis: {
        Row: {
          churn: number | null
          cliente_name: string
          created_at: string
          ebitda: number | null
          id: string
          month: string
          nps: number | null
          updated_at: string
        }
        Insert: {
          churn?: number | null
          cliente_name: string
          created_at?: string
          ebitda?: number | null
          id?: string
          month: string
          nps?: number | null
          updated_at?: string
        }
        Update: {
          churn?: number | null
          cliente_name?: string
          created_at?: string
          ebitda?: number | null
          id?: string
          month?: string
          nps?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          Ativo: boolean
          cidade: string | null
          cliente_id: number
          created_at: string | null
          horas_consumidas: number
          horas_contratadas: number
          horas_hg_contratadas: number | null
          logo_url: string | null
          nome: string
          projetos_quantidade: number
          status: string | null
          tipo_horas: string
        }
        Insert: {
          Ativo?: boolean
          cidade?: string | null
          cliente_id?: number
          created_at?: string | null
          horas_consumidas?: number
          horas_contratadas?: number
          horas_hg_contratadas?: number | null
          logo_url?: string | null
          nome: string
          projetos_quantidade?: number
          status?: string | null
          tipo_horas: string
        }
        Update: {
          Ativo?: boolean
          cidade?: string | null
          cliente_id?: number
          created_at?: string | null
          horas_consumidas?: number
          horas_contratadas?: number
          horas_hg_contratadas?: number | null
          logo_url?: string | null
          nome?: string
          projetos_quantidade?: number
          status?: string | null
          tipo_horas?: string
        }
        Relationships: []
      }
      health_score_config: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          weight_churn: number
          weight_ebitda: number
          weight_nps: number
        }
        Insert: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          weight_churn?: number
          weight_ebitda?: number
          weight_nps?: number
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          weight_churn?: number
          weight_ebitda?: number
          weight_nps?: number
        }
        Relationships: []
      }
      project_contracted_hours: {
        Row: {
          contracted_hours: number
          created_at: string
          id: string
          notes: string | null
          project_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contracted_hours?: number
          created_at?: string
          id?: string
          notes?: string | null
          project_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contracted_hours?: number
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      project_financials: {
        Row: {
          created_at: string
          custo_hora: number | null
          custo_total_estimado: number | null
          id: string
          observacoes: string | null
          project_id: number
          receita_projeto: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_hora?: number | null
          custo_total_estimado?: number | null
          id?: string
          observacoes?: string | null
          project_id: number
          receita_projeto?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_hora?: number | null
          custo_total_estimado?: number | null
          id?: string
          observacoes?: string | null
          project_id?: number
          receita_projeto?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_financials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          active: boolean
          created_at: string
          id: number
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      task_deadline_changes: {
        Row: {
          change_description: string
          changed_by: string | null
          created_at: string
          detected_at: string
          id: string
          new_deadline: string | null
          previous_deadline: string | null
          sync_run_id: string | null
          task_id: number
          task_title: string | null
        }
        Insert: {
          change_description: string
          changed_by?: string | null
          created_at?: string
          detected_at?: string
          id?: string
          new_deadline?: string | null
          previous_deadline?: string | null
          sync_run_id?: string | null
          task_id: number
          task_title?: string | null
        }
        Update: {
          change_description?: string
          changed_by?: string | null
          created_at?: string
          detected_at?: string
          id?: string
          new_deadline?: string | null
          previous_deadline?: string | null
          sync_run_id?: string | null
          task_id?: number
          task_title?: string | null
        }
        Relationships: []
      }
      user_allowed_areas: {
        Row: {
          area_name: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          area_name: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          area_name?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_capacity: {
        Row: {
          available_hours: number
          created_at: string
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_hours?: number
          created_at?: string
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_hours?: number
          created_at?: string
          id?: string
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_client_access: {
        Row: {
          cliente_id: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          cliente_id: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          cliente_id?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_client_access_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      user_project_access: {
        Row: {
          created_at: string
          id: string
          project_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_project_access_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          active: boolean
          auth_user_id: string
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          id: string
          name: string
          seniority_level: string | null
          updated_at: string
          user_profile: string
        }
        Insert: {
          active?: boolean
          auth_user_id: string
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          id?: string
          name?: string
          seniority_level?: string | null
          updated_at?: string
          user_profile?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          id?: string
          name?: string
          seniority_level?: string | null
          updated_at?: string
          user_profile?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "consultor" | "gerente" | "coordenador" | "cliente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "consultor", "gerente", "coordenador", "cliente"],
    },
  },
} as const
