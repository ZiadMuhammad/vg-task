export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      approved_recipients: {
        Row: {
          approval_id: string;
          batch_number: number;
          bounced: boolean;
          brand_id: string;
          contact_id: string;
          delivered: boolean;
          destination: string;
          external_id: string;
          full_name: string;
          id: string;
          opened: boolean;
          position: number;
          submission_reason: string | null;
          submission_status: string;
          unsubscribed: boolean;
        };
        Insert: {
          approval_id: string;
          batch_number: number;
          bounced?: boolean;
          brand_id: string;
          contact_id: string;
          delivered?: boolean;
          destination: string;
          external_id: string;
          full_name: string;
          id?: string;
          opened?: boolean;
          position: number;
          submission_reason?: string | null;
          submission_status?: string;
          unsubscribed?: boolean;
        };
        Update: {
          approval_id?: string;
          batch_number?: number;
          bounced?: boolean;
          brand_id?: string;
          contact_id?: string;
          delivered?: boolean;
          destination?: string;
          external_id?: string;
          full_name?: string;
          id?: string;
          opened?: boolean;
          position?: number;
          submission_reason?: string | null;
          submission_status?: string;
          unsubscribed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "approved_recipients_brand_id_approval_id_fkey";
            columns: ["brand_id", "approval_id"];
            isOneToOne: false;
            referencedRelation: "campaign_approvals";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "approved_recipients_brand_id_approval_id_fkey";
            columns: ["brand_id", "approval_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_metrics";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "approved_recipients_brand_id_contact_id_fkey";
            columns: ["brand_id", "contact_id"];
            isOneToOne: false;
            referencedRelation: "contactability";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "approved_recipients_brand_id_contact_id_fkey";
            columns: ["brand_id", "contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
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
      campaign_approvals: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          audience_hash: string;
          brand_id: string;
          campaign_id: string;
          campaign_name: string;
          channel: string;
          expires_at: string;
          id: string;
          prepared_at: string;
          recipient_count: number;
          target_country: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          audience_hash?: string;
          brand_id: string;
          campaign_id: string;
          campaign_name: string;
          channel: string;
          expires_at?: string;
          id?: string;
          prepared_at?: string;
          recipient_count?: number;
          target_country?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          audience_hash?: string;
          brand_id?: string;
          campaign_id?: string;
          campaign_name?: string;
          channel?: string;
          expires_at?: string;
          id?: string;
          prepared_at?: string;
          recipient_count?: number;
          target_country?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_approvals_brand_id_campaign_id_fkey";
            columns: ["brand_id", "campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaign_metrics";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "campaign_approvals_brand_id_campaign_id_fkey";
            columns: ["brand_id", "campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["brand_id", "id"];
          },
        ];
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
      provider_batches: {
        Row: {
          approval_id: string;
          attempts: number;
          batch_number: number;
          brand_id: string;
          created_at: string;
          id: string;
          last_error: string | null;
          last_synced_at: string | null;
          next_attempt_at: string;
          provider_batch_id: string | null;
          status: string;
        };
        Insert: {
          approval_id: string;
          attempts?: number;
          batch_number: number;
          brand_id: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          next_attempt_at?: string;
          provider_batch_id?: string | null;
          status?: string;
        };
        Update: {
          approval_id?: string;
          attempts?: number;
          batch_number?: number;
          brand_id?: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          next_attempt_at?: string;
          provider_batch_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_batches_brand_id_approval_id_fkey";
            columns: ["brand_id", "approval_id"];
            isOneToOne: false;
            referencedRelation: "campaign_approvals";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "provider_batches_brand_id_approval_id_fkey";
            columns: ["brand_id", "approval_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_metrics";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      provider_event_issues: {
        Row: {
          batch_id: string;
          brand_id: string;
          fingerprint: string;
          first_seen_at: string;
          id: number;
          reason: string;
        };
        Insert: {
          batch_id: string;
          brand_id: string;
          fingerprint: string;
          first_seen_at?: string;
          id?: never;
          reason: string;
        };
        Update: {
          batch_id?: string;
          brand_id?: string;
          fingerprint?: string;
          first_seen_at?: string;
          id?: never;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_event_issues_brand_id_batch_id_fkey";
            columns: ["brand_id", "batch_id"];
            isOneToOne: false;
            referencedRelation: "provider_batches";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      provider_events: {
        Row: {
          batch_id: string;
          brand_id: string;
          event_id: string;
          event_type: string;
          occurred_at: string | null;
          received_at: string;
          recipient_id: string;
        };
        Insert: {
          batch_id: string;
          brand_id: string;
          event_id: string;
          event_type: string;
          occurred_at?: string | null;
          received_at?: string;
          recipient_id: string;
        };
        Update: {
          batch_id?: string;
          brand_id?: string;
          event_id?: string;
          event_type?: string;
          occurred_at?: string | null;
          received_at?: string;
          recipient_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_events_brand_id_batch_id_fkey";
            columns: ["brand_id", "batch_id"];
            isOneToOne: false;
            referencedRelation: "provider_batches";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "provider_events_brand_id_recipient_id_fkey";
            columns: ["brand_id", "recipient_id"];
            isOneToOne: false;
            referencedRelation: "approved_recipients";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
    };
    Views: {
      campaign_metrics: {
        Row: {
          brand_id: string | null;
          channel: string | null;
          external_id: string | null;
          id: string | null;
          import_run_id: string | null;
          name: string | null;
          observed_events: number | null;
          observed_unique_bounces: number | null;
          observed_unique_clicks: number | null;
          observed_unique_complaints: number | null;
          observed_unique_opens: number | null;
          observed_unique_unsubscribes: number | null;
          parent_external_id: string | null;
          reported_bounced: number | null;
          reported_clicks: number | null;
          reported_delivered: number | null;
          reported_opens: number | null;
          reported_sent: number | null;
          sent_at: string | null;
          source_local_time: string | null;
          spend_minor: number | null;
          target_country: string | null;
          unattributed_events: number | null;
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
      dispatch_metrics: {
        Row: {
          accepted: number | null;
          approved_at: string | null;
          approved_by: string | null;
          attention_batches: number | null;
          audience_hash: string | null;
          bounced: number | null;
          brand_id: string | null;
          campaign_id: string | null;
          campaign_name: string | null;
          channel: string | null;
          delivered: number | null;
          expired: boolean | null;
          expires_at: string | null;
          id: string | null;
          issue_count: number | null;
          last_synced_at: string | null;
          opened: number | null;
          pending_batches: number | null;
          prepared_at: string | null;
          queued: number | null;
          recipient_count: number | null;
          rejected: number | null;
          target_country: string | null;
          unsubscribed: number | null;
          withheld: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_approvals_brand_id_campaign_id_fkey";
            columns: ["brand_id", "campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaign_metrics";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "campaign_approvals_brand_id_campaign_id_fkey";
            columns: ["brand_id", "campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
    };
    Functions: {
      claim_dispatch: { Args: never; Returns: Json };
      claim_event_poll: { Args: never; Returns: Json };
      confirm_campaign: {
        Args: { p_approval_id: string; p_count: number; p_hash: string };
        Returns: string;
      };
      dashboard_summary: { Args: never; Returns: Json };
      fail_dispatch: {
        Args: {
          p_attention?: boolean;
          p_batch_id: string;
          p_delay: number;
          p_reason: string;
          p_token: string;
        };
        Returns: boolean;
      };
      fail_event_poll: {
        Args: {
          p_batch_id: string;
          p_delay: number;
          p_reason: string;
          p_token: string;
        };
        Returns: undefined;
      };
      finish_dispatch: {
        Args: {
          p_batch_id: string;
          p_provider_id: string;
          p_results: Json;
          p_token: string;
        };
        Returns: boolean;
      };
      finish_event_poll: {
        Args: {
          p_batch_id: string;
          p_cursor: string;
          p_events: Json;
          p_issues: Json;
          p_more: boolean;
          p_token: string;
        };
        Returns: boolean;
      };
      ingest_contacts: {
        Args: { p_brand_id: string; p_rows: Json };
        Returns: number;
      };
      prepare_campaign: {
        Args: { p_campaign_id: string; p_refresh?: boolean };
        Returns: string;
      };
      reconcile_import_page: {
        Args: { p_after?: string; p_brand_id: string };
        Returns: Json;
      };
      retry_campaign: { Args: { p_approval_id: string }; Returns: undefined };
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
    | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
    | { schema: keyof DatabaseWithoutInternals },
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
