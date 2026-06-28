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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          client_id: string
          clinic_id: string
          conversation_id: string | null
          created_at: string
          ends_at: string
          external_calendar_event_id: string | null
          id: string
          metadata: Json
          notes: string | null
          pet_id: string | null
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          clinic_id: string
          conversation_id?: string | null
          created_at?: string
          ends_at: string
          external_calendar_event_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          pet_id?: string | null
          service_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          clinic_id?: string
          conversation_id?: string | null
          created_at?: string
          ends_at?: string
          external_calendar_event_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          pet_id?: string | null
          service_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "v_active_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          clinic_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          metadata: Json
          notes: string | null
          phone: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          phone: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          phone?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_channels: {
        Row: {
          channel_type: Database["public"]["Enums"]["channel_type"]
          clinic_id: string
          created_at: string
          id: string
          identifier: string
          provider: string
          provider_config: Json
          status: Database["public"]["Enums"]["channel_status"]
          updated_at: string
        }
        Insert: {
          channel_type: Database["public"]["Enums"]["channel_type"]
          clinic_id: string
          created_at?: string
          id?: string
          identifier: string
          provider: string
          provider_config?: Json
          status?: Database["public"]["Enums"]["channel_status"]
          updated_at?: string
        }
        Update: {
          channel_type?: Database["public"]["Enums"]["channel_type"]
          clinic_id?: string
          created_at?: string
          id?: string
          identifier?: string
          provider?: string
          provider_config?: Json
          status?: Database["public"]["Enums"]["channel_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_channels_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_config: {
        Row: {
          clinic_id: string
          config: Json
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          clinic_id: string
          config?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          clinic_id?: string
          config?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinic_config_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_config_history: {
        Row: {
          clinic_id: string
          config: Json
          created_at: string
          id: string
          updated_by: string | null
          version: number
        }
        Insert: {
          clinic_id: string
          config: Json
          created_at?: string
          id?: string
          updated_by?: string | null
          version: number
        }
        Update: {
          clinic_id?: string
          config?: Json
          created_at?: string
          id?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinic_config_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_integrations: {
        Row: {
          clinic_id: string
          created_at: string
          external_account_email: string | null
          id: string
          last_synced_at: string | null
          metadata: Json
          provider: string
          scope: string | null
          token_expires_at: string
          updated_at: string
          vault_secret_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          external_account_email?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          provider: string
          scope?: string | null
          token_expires_at: string
          updated_at?: string
          vault_secret_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          external_account_email?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          provider?: string
          scope?: string | null
          token_expires_at?: string
          updated_at?: string
          vault_secret_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_integrations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_invitations: {
        Row: {
          accepted_at: string | null
          clinic_id: string
          created_at: string
          display_name: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["clinic_user_role"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          clinic_id: string
          created_at?: string
          display_name?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["clinic_user_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          clinic_id?: string
          created_at?: string
          display_name?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["clinic_user_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_invitations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_users: {
        Row: {
          clinic_id: string
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          role: Database["public"]["Enums"]["clinic_user_role"]
          specialty_primary: string | null
          specialty_secondary: string[] | null
          staff_type: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role: Database["public"]["Enums"]["clinic_user_role"]
          specialty_primary?: string | null
          specialty_secondary?: string[] | null
          staff_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["clinic_user_role"]
          specialty_primary?: string | null
          specialty_secondary?: string[] | null
          staff_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_users_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_street: string | null
          created_at: string
          email: string | null
          id: string
          legal_name: string | null
          locale: string
          metadata: Json
          name: string
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["clinic_status"]
          tax_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          locale?: string
          metadata?: Json
          name: string
          phone?: string | null
          slug: string
          status?: Database["public"]["Enums"]["clinic_status"]
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          locale?: string
          metadata?: Json
          name?: string
          phone?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["clinic_status"]
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_summaries: {
        Row: {
          clinic_id: string
          conversation_id: string
          created_at: string
          model_used: string | null
          summary: Json
        }
        Insert: {
          clinic_id: string
          conversation_id: string
          created_at?: string
          model_used?: string | null
          summary: Json
        }
        Update: {
          clinic_id?: string
          conversation_id?: string
          created_at?: string
          model_used?: string | null
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "conversation_summaries_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "v_active_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["conversation_category"] | null
          channel: Database["public"]["Enums"]["channel_type"]
          channel_thread_id: string | null
          client_id: string | null
          clinic_id: string
          created_at: string
          deleted_at: string | null
          ended_at: string | null
          id: string
          metadata: Json
          pet_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["conversation_status"]
          updated_at: string
          urgency_level: Database["public"]["Enums"]["urgency_level"] | null
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["conversation_category"] | null
          channel: Database["public"]["Enums"]["channel_type"]
          channel_thread_id?: string | null
          client_id?: string | null
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json
          pet_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["conversation_category"] | null
          channel?: Database["public"]["Enums"]["channel_type"]
          channel_thread_id?: string | null
          client_id?: string | null
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json
          pet_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          clinic_id: string
          conversation_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          clinic_id: string
          conversation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          clinic_id?: string
          conversation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "v_active_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          clinic_id: string
          content: string | null
          content_type: Database["public"]["Enums"]["message_content_type"]
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          metadata: Json
          provider_message_id: string | null
          sender: Database["public"]["Enums"]["message_sender"]
          sender_user_id: string | null
        }
        Insert: {
          attachments?: Json
          clinic_id: string
          content?: string | null
          content_type?: Database["public"]["Enums"]["message_content_type"]
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          metadata?: Json
          provider_message_id?: string | null
          sender: Database["public"]["Enums"]["message_sender"]
          sender_user_id?: string | null
        }
        Update: {
          attachments?: Json
          clinic_id?: string
          content?: string | null
          content_type?: Database["public"]["Enums"]["message_content_type"]
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          metadata?: Json
          provider_message_id?: string | null
          sender?: Database["public"]["Enums"]["message_sender"]
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "v_active_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          active: boolean
          birth_date: string | null
          breed: string | null
          chip_number: string | null
          client_id: string
          clinic_id: string
          created_at: string
          deleted_at: string | null
          id: string
          metadata: Json
          name: string
          notes: string | null
          sex: Database["public"]["Enums"]["pet_sex"]
          species: Database["public"]["Enums"]["pet_species"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          birth_date?: string | null
          breed?: string | null
          chip_number?: string | null
          client_id: string
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          name: string
          notes?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          species: Database["public"]["Enums"]["pet_species"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          birth_date?: string | null
          breed?: string | null
          chip_number?: string | null
          client_id?: string
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          notes?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          species?: Database["public"]["Enums"]["pet_species"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          escalates_for_pricing: boolean
          id: string
          is_surgery: boolean
          name: string
          price_max_cents: number | null
          price_min_cents: number | null
          requires_fasting: boolean
          requires_specific_vet_user_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          escalates_for_pricing?: boolean
          id?: string
          is_surgery?: boolean
          name: string
          price_max_cents?: number | null
          price_min_cents?: number | null
          requires_fasting?: boolean
          requires_specific_vet_user_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          escalates_for_pricing?: boolean
          id?: string
          is_surgery?: boolean
          name?: string
          price_max_cents?: number | null
          price_min_cents?: number | null
          requires_fasting?: boolean
          requires_specific_vet_user_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_requires_specific_vet_user_id_fkey"
            columns: ["requires_specific_vet_user_id"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_invocations: {
        Row: {
          clinic_id: string
          conversation_id: string
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          id: string
          input: Json
          output: Json | null
          success: boolean
          tool_name: string
        }
        Insert: {
          clinic_id: string
          conversation_id: string
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          input: Json
          output?: Json | null
          success: boolean
          tool_name: string
        }
        Update: {
          clinic_id?: string
          conversation_id?: string
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          input?: Json
          output?: Json | null
          success?: boolean
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_invocations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_invocations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_invocations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "v_active_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_calendars: {
        Row: {
          calendar_summary: string | null
          clinic_id: string
          created_at: string
          google_calendar_id: string
          id: string
          last_synced_at: string | null
          sync_enabled: boolean
          updated_at: string
          vet_user_id: string
        }
        Insert: {
          calendar_summary?: string | null
          clinic_id: string
          created_at?: string
          google_calendar_id: string
          id?: string
          last_synced_at?: string | null
          sync_enabled?: boolean
          updated_at?: string
          vet_user_id: string
        }
        Update: {
          calendar_summary?: string | null
          clinic_id?: string
          created_at?: string
          google_calendar_id?: string
          id?: string
          last_synced_at?: string | null
          sync_enabled?: boolean
          updated_at?: string
          vet_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_calendars_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_calendars_vet_user_id_fkey"
            columns: ["vet_user_id"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_consultation_hours: {
        Row: {
          clinic_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          updated_at: string
          vet_user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          updated_at?: string
          vet_user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
          vet_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_consultation_hours_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_consultation_hours_vet_user_id_fkey"
            columns: ["vet_user_id"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_active_conversations: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["conversation_category"] | null
          channel: Database["public"]["Enums"]["channel_type"] | null
          channel_thread_id: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          clinic_id: string | null
          created_at: string | null
          deleted_at: string | null
          ended_at: string | null
          id: string | null
          last_message_at: string | null
          message_count: number | null
          metadata: Json | null
          pet_id: string | null
          pet_name: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["conversation_status"] | null
          updated_at: string | null
          urgency_level: Database["public"]["Enums"]["urgency_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      v_today_appointments: {
        Row: {
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          clinic_id: string | null
          conversation_id: string | null
          created_at: string | null
          ends_at: string | null
          external_calendar_event_id: string | null
          id: string | null
          metadata: Json | null
          notes: string | null
          pet_id: string | null
          pet_name: string | null
          pet_species: Database["public"]["Enums"]["pet_species"] | null
          service_id: string | null
          service_name: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "v_active_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      user_clinic_ids: { Args: never; Returns: string[] }
      user_has_role_in_clinic: {
        Args: {
          p_clinic_id: string
          p_roles: Database["public"]["Enums"]["clinic_user_role"][]
        }
        Returns: boolean
      }
      vault_create_secret: {
        Args: { p_description?: string; p_name?: string; p_secret: string }
        Returns: string
      }
      vault_delete_secret: { Args: { p_id: string }; Returns: boolean }
      vault_read_secret: { Args: { p_id: string }; Returns: string }
      vault_update_secret: {
        Args: {
          p_description?: string
          p_id: string
          p_name?: string
          p_secret: string
        }
        Returns: undefined
      }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "cancelled"
        | "no_show"
        | "completed"
      channel_status: "active" | "paused" | "error" | "pending_verification"
      channel_type: "whatsapp" | "phone" | "web"
      clinic_status: "active" | "suspended" | "archived"
      clinic_user_role: "admin" | "recepcion" | "veterinario"
      conversation_category:
        | "cita"
        | "urgencia"
        | "vacunacion"
        | "peluqueria"
        | "hospitalizacion"
        | "medicacion"
        | "receta"
        | "informe"
        | "administracion"
        | "informacion_general"
      conversation_status:
        | "active"
        | "awaiting_human"
        | "human_handling"
        | "completed"
        | "transferred"
        | "abandoned"
      message_content_type:
        | "text"
        | "audio"
        | "image"
        | "document"
        | "system_event"
        | "tool_call"
        | "tool_result"
      message_direction: "inbound" | "outbound"
      message_sender: "client" | "agent" | "human" | "system"
      pet_sex: "male" | "female" | "unknown"
      pet_species:
        | "dog"
        | "cat"
        | "rabbit"
        | "ferret"
        | "rodent"
        | "bird"
        | "reptile"
        | "fish"
        | "exotic"
        | "other"
      service_category:
        | "consultation"
        | "vaccine"
        | "surgery"
        | "grooming"
        | "adn"
        | "bureaucratic"
        | "diagnostic"
        | "other"
      urgency_level: "low" | "medium" | "high" | "critical"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: [
        "scheduled",
        "confirmed",
        "cancelled",
        "no_show",
        "completed",
      ],
      channel_status: ["active", "paused", "error", "pending_verification"],
      channel_type: ["whatsapp", "phone", "web"],
      clinic_status: ["active", "suspended", "archived"],
      clinic_user_role: ["admin", "recepcion", "veterinario"],
      conversation_category: [
        "cita",
        "urgencia",
        "vacunacion",
        "peluqueria",
        "hospitalizacion",
        "medicacion",
        "receta",
        "informe",
        "administracion",
        "informacion_general",
      ],
      conversation_status: [
        "active",
        "awaiting_human",
        "human_handling",
        "completed",
        "transferred",
        "abandoned",
      ],
      message_content_type: [
        "text",
        "audio",
        "image",
        "document",
        "system_event",
        "tool_call",
        "tool_result",
      ],
      message_direction: ["inbound", "outbound"],
      message_sender: ["client", "agent", "human", "system"],
      pet_sex: ["male", "female", "unknown"],
      pet_species: [
        "dog",
        "cat",
        "rabbit",
        "ferret",
        "rodent",
        "bird",
        "reptile",
        "fish",
        "exotic",
        "other",
      ],
      service_category: [
        "consultation",
        "vaccine",
        "surgery",
        "grooming",
        "adn",
        "bureaucratic",
        "diagnostic",
        "other",
      ],
      urgency_level: ["low", "medium", "high", "critical"],
    },
  },
} as const
