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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          state: string | null
          updated_at: string
          user_id: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          state?: string | null
          updated_at?: string
          user_id: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          state?: string | null
          updated_at?: string
          user_id?: string
          zip?: string | null
        }
        Relationships: []
      }
      rent_allocations: {
        Row: {
          amount_applied: number
          created_at: string
          id: string
          month_applied_to: string
          transaction_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount_applied: number
          created_at?: string
          id?: string
          month_applied_to: string
          transaction_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount_applied?: number
          created_at?: string
          id?: string
          month_applied_to?: string
          transaction_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_allocations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_allocations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          category: Database["public"]["Enums"]["transaction_category"]
          created_at: string
          id: string
          is_active: boolean
          match_type: Database["public"]["Enums"]["rule_match_type"]
          name: string
          pattern: string
          priority: number
          property_id: string | null
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["transaction_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          match_type?: Database["public"]["Enums"]["rule_match_type"]
          name: string
          pattern: string
          priority?: number
          property_id?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["transaction_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          match_type?: Database["public"]["Enums"]["rule_match_type"]
          name?: string
          pattern?: string
          priority?: number
          property_id?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rules_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_uploads: {
        Row: {
          completed_at: string | null
          duplicate_count: number | null
          error_message: string | null
          filename: string
          id: string
          processed_count: number | null
          row_count: number | null
          status: Database["public"]["Enums"]["statement_upload_status"]
          uploaded_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          duplicate_count?: number | null
          error_message?: string | null
          filename: string
          id?: string
          processed_count?: number | null
          row_count?: number | null
          status?: Database["public"]["Enums"]["statement_upload_status"]
          uploaded_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          duplicate_count?: number | null
          error_message?: string | null
          filename?: string
          id?: string
          processed_count?: number | null
          row_count?: number | null
          status?: Database["public"]["Enums"]["statement_upload_status"]
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          lease_end: string | null
          lease_start: string | null
          name: string
          phone: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lease_end?: string | null
          lease_start?: string | null
          name: string
          phone?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lease_end?: string | null
          lease_start?: string | null
          name?: string
          phone?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_notes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["transaction_category"]
          created_at: string
          date: string
          description: string
          hash: string
          id: string
          needs_review: boolean
          property_id: string | null
          raw_json: Json | null
          statement_upload_id: string | null
          subcategory: string | null
          tenant_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["transaction_category"]
          created_at?: string
          date: string
          description: string
          hash: string
          id?: string
          needs_review?: boolean
          property_id?: string | null
          raw_json?: Json | null
          statement_upload_id?: string | null
          subcategory?: string | null
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          unit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["transaction_category"]
          created_at?: string
          date?: string
          description?: string
          hash?: string
          id?: string
          needs_review?: boolean
          property_id?: string | null
          raw_json?: Json | null
          statement_upload_id?: string | null
          subcategory?: string | null
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_statement_upload_id_fkey"
            columns: ["statement_upload_id"]
            isOneToOne: false
            referencedRelation: "statement_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          id: string
          label: string
          monthly_rent: number
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          monthly_rent?: number
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          monthly_rent?: number
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      rule_match_type: "contains" | "regex"
      statement_upload_status: "pending" | "processing" | "completed" | "failed"
      transaction_category:
        | "rent_income"
        | "other_income"
        | "mortgage"
        | "property_tax"
        | "insurance"
        | "utilities"
        | "maintenance"
        | "management_fee"
        | "hoa_fee"
        | "legal"
        | "advertising"
        | "supplies"
        | "travel"
        | "transfer"
        | "uncategorized"
      transaction_type: "income" | "expense"
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
      rule_match_type: ["contains", "regex"],
      statement_upload_status: ["pending", "processing", "completed", "failed"],
      transaction_category: [
        "rent_income",
        "other_income",
        "mortgage",
        "property_tax",
        "insurance",
        "utilities",
        "maintenance",
        "management_fee",
        "hoa_fee",
        "legal",
        "advertising",
        "supplies",
        "travel",
        "transfer",
        "uncategorized",
      ],
      transaction_type: ["income", "expense"],
    },
  },
} as const
