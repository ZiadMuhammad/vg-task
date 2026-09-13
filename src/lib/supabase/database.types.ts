export type Json =
  | string
  | number
  | boolean
  | null
  | {
      [key: string]: Json | undefined;
    }
  | Json[];
export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      brands: {
        Row: {
          code: string;
          country: string;
          created_at: string;
          id: string;
          name: string;
          timezone: string;
        };
        Insert: {
          code: string;
          country: string;
          created_at?: string;
          id?: string;
          name: string;
          timezone: string;
        };
        Update: {
          code?: string;
          country?: string;
          created_at?: string;
          id?: string;
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          brand_id: string;
          channel: string;
          external_id: string;
          id: string;
          import_run_id: string;
          name: string;
          parent_external_id: string | null;
          reported_bounced: number;
          reported_clicks: number;
          reported_delivered: number;
          reported_opens: number;
          reported_sent: number;
          sent_at: string;
          source_local_time: string | null;
          spend_minor: number;
          target_country: string | null;
        };
        Insert: {
          brand_id: string;
          channel: string;
          external_id: string;
          id?: string;
          import_run_id: string;
          name: string;
          parent_external_id?: string | null;
          reported_bounced: number;
          reported_clicks: number;
          reported_delivered: number;
          reported_opens: number;
          reported_sent: number;
          sent_at: string;
          source_local_time?: string | null;
          spend_minor: number;
          target_country?: string | null;
        };
        Update: {
          brand_id?: string;
          channel?: string;
          external_id?: string;
          id?: string;
          import_run_id?: string;
          name?: string;
          parent_external_id?: string | null;
          reported_bounced?: number;
          reported_clicks?: number;
          reported_delivered?: number;
          reported_opens?: number;
          reported_sent?: number;
          sent_at?: string;
          source_local_time?: string | null;
          spend_minor?: number;
          target_country?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_brand_id_import_run_id_fkey";
            columns: ["brand_id", "import_run_id"];
            isOneToOne: false;
            referencedRelation: "import_runs";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      contacts: {
        Row: {
          brand_id: string;
          city: string | null;
          consent_marketing: boolean;
          country: string | null;
          deleted_at: string | null;
          email: string | null;
          email_bounced: boolean;
          external_id: string;
          full_name: string;
          global_opt_out: boolean;
          id: string;
          import_run_id: string;
          phone: string | null;
          signup_at: string | null;
          sms_bounced: boolean;
          source_priority: number;
          status: string;
          suppressed_until: string | null;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          city?: string | null;
          consent_marketing: boolean;
          country?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          email_bounced?: boolean;
          external_id: string;
          full_name: string;
          global_opt_out?: boolean;
          id?: string;
          import_run_id: string;
          phone?: string | null;
          signup_at?: string | null;
          sms_bounced?: boolean;
          source_priority: number;
          status: string;
          suppressed_until?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          city?: string | null;
          consent_marketing?: boolean;
          country?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          email_bounced?: boolean;
          external_id?: string;
          full_name?: string;
          global_opt_out?: boolean;
          id?: string;
          import_run_id?: string;
          phone?: string | null;
          signup_at?: string | null;
          sms_bounced?: boolean;
          source_priority?: number;
          status?: string;
          suppressed_until?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_brand_id_import_run_id_fkey";
            columns: ["brand_id", "import_run_id"];
            isOneToOne: false;
            referencedRelation: "import_runs";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      historical_sends: {
        Row: {
          batch_key: string;
          brand_id: string;
          campaign_id: string;
          id: string;
          import_run_id: string;
          queued_at: string;
          recipient_count: number;
          status: string;
        };
        Insert: {
          batch_key: string;
          brand_id: string;
          campaign_id: string;
          id?: string;
          import_run_id: string;
          queued_at: string;
          recipient_count: number;
          status: string;
        };
        Update: {
          batch_key?: string;
          brand_id?: string;
          campaign_id?: string;
          id?: string;
          import_run_id?: string;
          queued_at?: string;
          recipient_count?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "historical_sends_brand_id_campaign_id_fkey";
            columns: ["brand_id", "campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaign_metrics";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "historical_sends_brand_id_campaign_id_fkey";
            columns: ["brand_id", "campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "historical_sends_brand_id_import_run_id_fkey";
            columns: ["brand_id", "import_run_id"];
            isOneToOne: false;
            referencedRelation: "import_runs";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      import_issues: {
        Row: {
          brand_id: string;
          code: string;
          external_id: string | null;
          id: number;
          import_run_id: string;
          message: string;
          raw: Json;
          row_number: number;
          severity: string;
        };
        Insert: {
          brand_id: string;
          code: string;
          external_id?: string | null;
          id?: never;
          import_run_id: string;
          message: string;
          raw: Json;
          row_number: number;
          severity: string;
        };
        Update: {
          brand_id?: string;
          code?: string;
          external_id?: string | null;
          id?: never;
          import_run_id?: string;
          message?: string;
          raw?: Json;
          row_number?: number;
          severity?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_issues_brand_id_import_run_id_fkey";
            columns: ["brand_id", "import_run_id"];
            isOneToOne: false;
            referencedRelation: "import_runs";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      import_runs: {
        Row: {
          accepted_rows: number;
          brand_id: string;
          duplicate_rows: number;
          encoding: string;
          error: string | null;
          file_name: string;
          finished_at: string | null;
          id: string;
          kind: string;
          rejected_rows: number;
          sha256: string;
          started_at: string;
          status: string;
          total_rows: number;
          warning_rows: number;
        };
        Insert: {
          accepted_rows?: number;
          brand_id: string;
          duplicate_rows?: number;
          encoding: string;
          error?: string | null;
          file_name: string;
          finished_at?: string | null;
          id?: string;
          kind: string;
          rejected_rows?: number;
          sha256: string;
          started_at?: string;
          status?: string;
          total_rows?: number;
          warning_rows?: number;
        };
        Update: {
          accepted_rows?: number;
          brand_id?: string;
          duplicate_rows?: number;
          encoding?: string;
          error?: string | null;
          file_name?: string;
          finished_at?: string | null;
          id?: string;
          kind?: string;
          rejected_rows?: number;
          sha256?: string;
          started_at?: string;
          status?: string;
          total_rows?: number;
          warning_rows?: number;
        };
        Relationships: [
          {
            foreignKeyName: "import_runs_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      imported_events: {
        Row: {
          attributed: boolean;
          brand_id: string;
          campaign_external_id: string;
          campaign_id: string | null;
          channel: string;
          contact_id: string;
          event_id: string;
          event_type: string;
          id: number;
          import_run_id: string;
          occurred_at: string;
        };
        Insert: {
          attributed: boolean;
          brand_id: string;
          campaign_external_id: string;
          campaign_id?: string | null;
          channel: string;
          contact_id: string;
          event_id: string;
          event_type: string;
          id?: never;
          import_run_id: string;
          occurred_at: string;
        };
        Update: {
          attributed?: boolean;
          brand_id?: string;
          campaign_external_id?: string;
          campaign_id?: string | null;
          channel?: string;
          contact_id?: string;
          event_id?: string;
          event_type?: string;
          id?: never;
          import_run_id?: string;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "imported_events_brand_id_campaign_id_fkey";
            columns: ["brand_id", "campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaign_metrics";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "imported_events_brand_id_campaign_id_fkey";
            columns: ["brand_id", "campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "imported_events_brand_id_contact_id_fkey";
            columns: ["brand_id", "contact_id"];
            isOneToOne: false;
            referencedRelation: "contactability";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "imported_events_brand_id_contact_id_fkey";
            columns: ["brand_id", "contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "imported_events_brand_id_import_run_id_fkey";
            columns: ["brand_id", "import_run_id"];
            isOneToOne: false;
            referencedRelation: "import_runs";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      memberships: {
        Row: {
          brand_id: string;
          display_name: string;
          role: string;
          user_id: string;
        };
        Insert: {
          brand_id: string;
          display_name: string;
          role: string;
          user_id: string;
        };
        Update: {
          brand_id?: string;
          display_name?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      contactability: {
        Row: {
          brand_id: string | null;
          city: string | null;
          consent_marketing: boolean | null;
          contactable_email: boolean | null;
          contactable_sms: boolean | null;
          country: string | null;
          deleted_at: string | null;
          email: string | null;
          email_bounced: boolean | null;
          external_id: string | null;
          full_name: string | null;
          global_opt_out: boolean | null;
          id: string | null;
          import_run_id: string | null;
          phone: string | null;
          signup_at: string | null;
          sms_bounced: boolean | null;
          source_priority: number | null;
          status: string | null;
          suppressed_until: string | null;
          updated_at: string | null;
        };
        Insert: {
          brand_id?: string | null;
          city?: string | null;
          consent_marketing?: boolean | null;
          contactable_email?: never;
          contactable_sms?: never;
          country?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          email_bounced?: boolean | null;
          external_id?: string | null;
          full_name?: string | null;
          global_opt_out?: boolean | null;
          id?: string | null;
          import_run_id?: string | null;
          phone?: string | null;
          signup_at?: string | null;
          sms_bounced?: boolean | null;
          source_priority?: number | null;
          status?: string | null;
          suppressed_until?: string | null;
          updated_at?: string | null;
        };
        Update: {
          brand_id?: string | null;
          city?: string | null;
          consent_marketing?: boolean | null;
          contactable_email?: never;
          contactable_sms?: never;
          country?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          email_bounced?: boolean | null;
          external_id?: string | null;
          full_name?: string | null;
          global_opt_out?: boolean | null;
          id?: string | null;
          import_run_id?: string | null;
          phone?: string | null;
          signup_at?: string | null;
          sms_bounced?: boolean | null;
          source_priority?: number | null;
          status?: string | null;
          suppressed_until?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_brand_id_import_run_id_fkey";
            columns: ["brand_id", "import_run_id"];
            isOneToOne: false;
            referencedRelation: "import_runs";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
    };
    Functions: {
      ingest_contacts: {
        Args: {
          p_brand_id: string;
          p_rows: Json;
        };
        Returns: number;
      };
      reconcile_import_page: {
        Args: {
          p_after?: string;
          p_brand_id: string;
        };
        Returns: Json;
      };
      search_contacts: {
        Args: {
          p_country?: string;
          p_eligibility?: string;
          p_page?: number;
          p_query?: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];
export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | {
        schema: keyof DatabaseWithoutInternals;
      },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;
export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | {
        schema: keyof DatabaseWithoutInternals;
      },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;
export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | {
        schema: keyof DatabaseWithoutInternals;
      },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;
export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | {
        schema: keyof DatabaseWithoutInternals;
      },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;
export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | {
        schema: keyof DatabaseWithoutInternals;
      },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;
export const Constants = {
  public: {
    Enums: {},
  },
} as const;
