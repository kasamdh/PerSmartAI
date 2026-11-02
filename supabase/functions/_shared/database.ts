// GENERATED from packages/shared/src/database.ts by scripts/sync-shared.mjs. Do not edit;
// change the source and run `npm run shared:sync`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      booking_care_times: {
        Row: {
          booking_id: string;
          care_time: string;
          created_at: string;
          duration_minutes: number;
          id: string;
          label: string;
          organization_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id: string;
          care_time: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          label: string;
          organization_id?: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          care_time?: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          label?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_care_times_booking_id_organization_id_fkey';
            columns: ['booking_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'booking_care_times_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_pets: {
        Row: {
          booking_id: string;
          created_at: string;
          id: string;
          organization_id: string;
          pet_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          pet_id: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          pet_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_pets_booking_id_organization_id_fkey';
            columns: ['booking_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'booking_pets_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_pets_pet_id_organization_id_fkey';
            columns: ['pet_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      bookings: {
        Row: {
          cancelled_at: string | null;
          created_at: string;
          duration_minutes: number | null;
          end_date: string | null;
          household_id: string;
          id: string;
          late_cancellation: boolean;
          notes: string | null;
          organization_id: string;
          recurrence_rule: string | null;
          series_id: string;
          service_type: Database['public']['Enums']['service_type'];
          sitter_id: string | null;
          start_date: string;
          status: Database['public']['Enums']['booking_status'];
          updated_at: string;
          window_end: string | null;
          window_start: string | null;
        };
        ComputedFields: never;
        Insert: {
          cancelled_at?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
          end_date?: string | null;
          household_id: string;
          id?: string;
          late_cancellation?: boolean;
          notes?: string | null;
          organization_id?: string;
          recurrence_rule?: string | null;
          series_id: string;
          service_type: Database['public']['Enums']['service_type'];
          sitter_id?: string | null;
          start_date: string;
          status?: Database['public']['Enums']['booking_status'];
          updated_at?: string;
          window_end?: string | null;
          window_start?: string | null;
        };
        Update: {
          cancelled_at?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
          end_date?: string | null;
          household_id?: string;
          id?: string;
          late_cancellation?: boolean;
          notes?: string | null;
          organization_id?: string;
          recurrence_rule?: string | null;
          series_id?: string;
          service_type?: Database['public']['Enums']['service_type'];
          sitter_id?: string | null;
          start_date?: string;
          status?: Database['public']['Enums']['booking_status'];
          updated_at?: string;
          window_end?: string | null;
          window_start?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_household_id_organization_id_fkey';
            columns: ['household_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'bookings_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_sitter_id_organization_id_fkey';
            columns: ['sitter_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      care_events: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          occurred_at: string;
          organization_id: string;
          pet_id: string | null;
          type: Database['public']['Enums']['care_event_type'];
          updated_at: string;
          value: NonNullable<Json>;
          visit_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          occurred_at?: string;
          organization_id?: string;
          pet_id?: string | null;
          type: Database['public']['Enums']['care_event_type'];
          updated_at?: string;
          value?: NonNullable<Json>;
          visit_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          occurred_at?: string;
          organization_id?: string;
          pet_id?: string | null;
          type?: Database['public']['Enums']['care_event_type'];
          updated_at?: string;
          value?: NonNullable<Json>;
          visit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'care_events_created_by_organization_id_fkey';
            columns: ['created_by', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'care_events_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'care_events_pet_id_organization_id_fkey';
            columns: ['pet_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'care_events_visit_id_organization_id_fkey';
            columns: ['visit_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'visits';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      conversation_reads: {
        Row: {
          household_id: string;
          organization_id: string;
          read_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          household_id: string;
          organization_id?: string;
          read_at?: string;
          user_id?: string;
        };
        Update: {
          household_id?: string;
          organization_id?: string;
          read_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_reads_household_id_organization_id_fkey';
            columns: ['household_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'conversation_reads_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_reads_user_id_organization_id_fkey';
            columns: ['user_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      emergency_contacts: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          is_primary: boolean;
          name: string;
          organization_id: string;
          phone: string;
          relationship: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          is_primary?: boolean;
          name: string;
          organization_id?: string;
          phone: string;
          relationship?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          is_primary?: boolean;
          name?: string;
          organization_id?: string;
          phone?: string;
          relationship?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'emergency_contacts_household_id_organization_id_fkey';
            columns: ['household_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'emergency_contacts_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      feeding_plans: {
        Row: {
          amount: number | null;
          created_at: string;
          food_brand: string | null;
          id: string;
          notes: string | null;
          organization_id: string;
          pet_id: string;
          times: string[];
          treats_allowed: boolean;
          unit: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount?: number | null;
          created_at?: string;
          food_brand?: string | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          pet_id: string;
          times?: string[];
          treats_allowed?: boolean;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          created_at?: string;
          food_brand?: string | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          pet_id?: string;
          times?: string[];
          treats_allowed?: boolean;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feeding_plans_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'feeding_plans_pet_id_organization_id_fkey';
            columns: ['pet_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      household_access: {
        Row: {
          alarm_notes: string | null;
          created_at: string;
          entry_instructions: string | null;
          household_id: string;
          id: string;
          organization_id: string;
          updated_at: string;
          wifi_name: string | null;
          wifi_password: string | null;
        };
        ComputedFields: never;
        Insert: {
          alarm_notes?: string | null;
          created_at?: string;
          entry_instructions?: string | null;
          household_id: string;
          id?: string;
          organization_id?: string;
          updated_at?: string;
          wifi_name?: string | null;
          wifi_password?: string | null;
        };
        Update: {
          alarm_notes?: string | null;
          created_at?: string;
          entry_instructions?: string | null;
          household_id?: string;
          id?: string;
          organization_id?: string;
          updated_at?: string;
          wifi_name?: string | null;
          wifi_password?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'household_access_household_id_organization_id_fkey';
            columns: ['household_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'household_access_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      households: {
        Row: {
          address_line1: string;
          address_line2: string | null;
          city: string;
          country_code: string;
          created_at: string;
          id: string;
          lat: number | null;
          lng: number | null;
          name: string | null;
          organization_id: string;
          owner_id: string;
          postal_code: string | null;
          region: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address_line1: string;
          address_line2?: string | null;
          city: string;
          country_code?: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          name?: string | null;
          organization_id?: string;
          owner_id: string;
          postal_code?: string | null;
          region?: string | null;
          updated_at?: string;
        };
        Update: {
          address_line1?: string;
          address_line2?: string | null;
          city?: string;
          country_code?: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          name?: string | null;
          organization_id?: string;
          owner_id?: string;
          postal_code?: string | null;
          region?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'households_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'households_owner_id_organization_id_fkey';
            columns: ['owner_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      incidents: {
        Row: {
          action_taken: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          media_id: string | null;
          organization_id: string;
          pet_id: string | null;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: Database['public']['Enums']['incident_severity'];
          updated_at: string;
          visit_id: string;
        };
        ComputedFields: never;
        Insert: {
          action_taken?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          media_id?: string | null;
          organization_id?: string;
          pet_id?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity: Database['public']['Enums']['incident_severity'];
          updated_at?: string;
          visit_id: string;
        };
        Update: {
          action_taken?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          media_id?: string | null;
          organization_id?: string;
          pet_id?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: Database['public']['Enums']['incident_severity'];
          updated_at?: string;
          visit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'incidents_created_by_organization_id_fkey';
            columns: ['created_by', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'incidents_media_fkey';
            columns: ['media_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'incidents_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'incidents_pet_id_organization_id_fkey';
            columns: ['pet_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'incidents_resolved_by_fkey';
            columns: ['resolved_by', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'incidents_visit_id_organization_id_fkey';
            columns: ['visit_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'visits';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          code: string;
          created_at: string;
          created_by: string | null;
          email: string | null;
          expires_at: string;
          id: string;
          organization_id: string;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          expires_at?: string;
          id?: string;
          organization_id?: string;
          role: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          expires_at?: string;
          id?: string;
          organization_id?: string;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invites_created_by_organization_id_fkey';
            columns: ['created_by', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'invites_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      media: {
        Row: {
          caption: string | null;
          created_at: string;
          created_by: string | null;
          duration_seconds: number | null;
          height: number | null;
          id: string;
          organization_id: string;
          pet_id: string | null;
          storage_path: string;
          thumb_path: string | null;
          type: Database['public']['Enums']['media_type'];
          updated_at: string;
          visit_id: string;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          caption?: string | null;
          created_at?: string;
          created_by?: string | null;
          duration_seconds?: number | null;
          height?: number | null;
          id?: string;
          organization_id?: string;
          pet_id?: string | null;
          storage_path: string;
          thumb_path?: string | null;
          type: Database['public']['Enums']['media_type'];
          updated_at?: string;
          visit_id: string;
          width?: number | null;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          created_by?: string | null;
          duration_seconds?: number | null;
          height?: number | null;
          id?: string;
          organization_id?: string;
          pet_id?: string | null;
          storage_path?: string;
          thumb_path?: string | null;
          type?: Database['public']['Enums']['media_type'];
          updated_at?: string;
          visit_id?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'media_created_by_organization_id_fkey';
            columns: ['created_by', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'media_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_pet_id_organization_id_fkey';
            columns: ['pet_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'media_visit_id_organization_id_fkey';
            columns: ['visit_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'visits';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      media_pets: {
        Row: {
          created_at: string;
          media_id: string;
          organization_id: string;
          pet_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          media_id: string;
          organization_id?: string;
          pet_id: string;
        };
        Update: {
          created_at?: string;
          media_id?: string;
          organization_id?: string;
          pet_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'media_pets_media_id_organization_id_fkey';
            columns: ['media_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'media_pets_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_pets_pet_id_organization_id_fkey';
            columns: ['pet_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      media_reactions: {
        Row: {
          created_at: string;
          media_id: string;
          organization_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          media_id: string;
          organization_id?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          media_id?: string;
          organization_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'media_reactions_media_id_organization_id_fkey';
            columns: ['media_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'media_reactions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_reactions_user_id_organization_id_fkey';
            columns: ['user_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      messages: {
        Row: {
          body: string | null;
          created_at: string;
          household_id: string;
          id: string;
          organization_id: string;
          photo_height: number | null;
          photo_path: string | null;
          photo_thumb_path: string | null;
          photo_width: number | null;
          sender_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          household_id: string;
          id?: string;
          organization_id?: string;
          photo_height?: number | null;
          photo_path?: string | null;
          photo_thumb_path?: string | null;
          photo_width?: number | null;
          sender_id?: string | null;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          organization_id?: string;
          photo_height?: number | null;
          photo_path?: string | null;
          photo_thumb_path?: string | null;
          photo_width?: number | null;
          sender_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_household_id_organization_id_fkey';
            columns: ['household_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'messages_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_organization_id_fkey';
            columns: ['sender_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      notification_log: {
        Row: {
          covered_until: string | null;
          id: string;
          key: string;
          kind: string;
          organization_id: string;
          sent_at: string;
          visit_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          covered_until?: string | null;
          id?: string;
          key: string;
          kind: string;
          organization_id: string;
          sent_at?: string;
          visit_id?: string | null;
        };
        Update: {
          covered_until?: string | null;
          id?: string;
          key?: string;
          kind?: string;
          organization_id?: string;
          sent_at?: string;
          visit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_log_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_log_visit_id_organization_id_fkey';
            columns: ['visit_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'visits';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      notification_settings: {
        Row: {
          created_at: string;
          muted: string[];
          organization_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          muted?: string[];
          organization_id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          muted?: string[];
          organization_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_settings_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_settings_user_id_organization_id_fkey';
            columns: ['user_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      organizations: {
        Row: {
          accent_color: string | null;
          cancellation_cutoff_hours: number;
          created_at: string;
          id: string;
          logo_path: string | null;
          logo_url: string | null;
          media_retention_months: number | null;
          name: string;
          primary_color: string | null;
          timezone: string;
          travel_buffer_minutes: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accent_color?: string | null;
          cancellation_cutoff_hours?: number;
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          logo_url?: string | null;
          media_retention_months?: number | null;
          name: string;
          primary_color?: string | null;
          timezone?: string;
          travel_buffer_minutes?: number;
          updated_at?: string;
        };
        Update: {
          accent_color?: string | null;
          cancellation_cutoff_hours?: number;
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          logo_url?: string | null;
          media_retention_months?: number | null;
          name?: string;
          primary_color?: string | null;
          timezone?: string;
          travel_buffer_minutes?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      pet_allergies: {
        Row: {
          allergen: string;
          created_at: string;
          id: string;
          organization_id: string;
          pet_id: string;
          reaction_notes: string | null;
          severity: Database['public']['Enums']['allergy_severity'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          allergen: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          pet_id: string;
          reaction_notes?: string | null;
          severity: Database['public']['Enums']['allergy_severity'];
          updated_at?: string;
        };
        Update: {
          allergen?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          pet_id?: string;
          reaction_notes?: string | null;
          severity?: Database['public']['Enums']['allergy_severity'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pet_allergies_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pet_allergies_pet_id_organization_id_fkey';
            columns: ['pet_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      pet_medications: {
        Row: {
          created_at: string;
          dose: string | null;
          id: string;
          instructions: string | null;
          name: string;
          organization_id: string;
          pet_id: string;
          schedule_times: string[];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dose?: string | null;
          id?: string;
          instructions?: string | null;
          name: string;
          organization_id?: string;
          pet_id: string;
          schedule_times?: string[];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dose?: string | null;
          id?: string;
          instructions?: string | null;
          name?: string;
          organization_id?: string;
          pet_id?: string;
          schedule_times?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pet_medications_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pet_medications_pet_id_organization_id_fkey';
            columns: ['pet_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      pets: {
        Row: {
          birth_date: string | null;
          breed: string | null;
          created_at: string;
          household_id: string;
          id: string;
          microchip: string | null;
          name: string;
          organization_id: string;
          photo_url: string | null;
          sex: Database['public']['Enums']['pet_sex'];
          spayed_neutered: boolean | null;
          species: Database['public']['Enums']['pet_species'];
          temperament_notes: string | null;
          updated_at: string;
          vet_address: string | null;
          vet_name: string | null;
          vet_phone: string | null;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          birth_date?: string | null;
          breed?: string | null;
          created_at?: string;
          household_id: string;
          id?: string;
          microchip?: string | null;
          name: string;
          organization_id?: string;
          photo_url?: string | null;
          sex?: Database['public']['Enums']['pet_sex'];
          spayed_neutered?: boolean | null;
          species: Database['public']['Enums']['pet_species'];
          temperament_notes?: string | null;
          updated_at?: string;
          vet_address?: string | null;
          vet_name?: string | null;
          vet_phone?: string | null;
          weight_kg?: number | null;
        };
        Update: {
          birth_date?: string | null;
          breed?: string | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          microchip?: string | null;
          name?: string;
          organization_id?: string;
          photo_url?: string | null;
          sex?: Database['public']['Enums']['pet_sex'];
          spayed_neutered?: boolean | null;
          species?: Database['public']['Enums']['pet_species'];
          temperament_notes?: string | null;
          updated_at?: string;
          vet_address?: string | null;
          vet_name?: string | null;
          vet_phone?: string | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pets_household_id_organization_id_fkey';
            columns: ['household_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'pets_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string;
          id: string;
          organization_id: string;
          phone: string | null;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name: string;
          id: string;
          organization_id: string;
          phone?: string | null;
          role: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          organization_id?: string;
          phone?: string | null;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      push_tokens: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          platform: Database['public']['Enums']['push_platform'];
          profile_id: string;
          token: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          platform: Database['public']['Enums']['push_platform'];
          profile_id?: string;
          token: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          platform?: Database['public']['Enums']['push_platform'];
          profile_id?: string;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_tokens_profile_id_organization_id_fkey';
            columns: ['profile_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      schedule_change_requests: {
        Row: {
          booking_id: string;
          changes: NonNullable<Json>;
          created_at: string;
          decided_at: string | null;
          decline_reason: string | null;
          from_date: string | null;
          id: string;
          note: string | null;
          organization_id: string;
          requested_by: string | null;
          scope: string;
          status: Database['public']['Enums']['change_request_status'];
          updated_at: string;
          visit_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          booking_id: string;
          changes: NonNullable<Json>;
          created_at?: string;
          decided_at?: string | null;
          decline_reason?: string | null;
          from_date?: string | null;
          id?: string;
          note?: string | null;
          organization_id?: string;
          requested_by?: string | null;
          scope: string;
          status?: Database['public']['Enums']['change_request_status'];
          updated_at?: string;
          visit_id?: string | null;
        };
        Update: {
          booking_id?: string;
          changes?: NonNullable<Json>;
          created_at?: string;
          decided_at?: string | null;
          decline_reason?: string | null;
          from_date?: string | null;
          id?: string;
          note?: string | null;
          organization_id?: string;
          requested_by?: string | null;
          scope?: string;
          status?: Database['public']['Enums']['change_request_status'];
          updated_at?: string;
          visit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'schedule_change_requests_booking_id_organization_id_fkey';
            columns: ['booking_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'schedule_change_requests_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'schedule_change_requests_visit_id_organization_id_fkey';
            columns: ['visit_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'visits';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      sitter_availability: {
        Row: {
          created_at: string;
          end_time: string;
          id: string;
          organization_id: string;
          sitter_id: string;
          start_time: string;
          updated_at: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_time: string;
          id?: string;
          organization_id?: string;
          sitter_id: string;
          start_time: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          created_at?: string;
          end_time?: string;
          id?: string;
          organization_id?: string;
          sitter_id?: string;
          start_time?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'sitter_availability_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sitter_availability_sitter_id_organization_id_fkey';
            columns: ['sitter_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      sitter_time_off: {
        Row: {
          created_at: string;
          end_at: string;
          id: string;
          organization_id: string;
          reason: string | null;
          reviewed_at: string | null;
          sitter_id: string;
          start_at: string;
          status: Database['public']['Enums']['time_off_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_at: string;
          id?: string;
          organization_id?: string;
          reason?: string | null;
          reviewed_at?: string | null;
          sitter_id: string;
          start_at: string;
          status?: Database['public']['Enums']['time_off_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_at?: string;
          id?: string;
          organization_id?: string;
          reason?: string | null;
          reviewed_at?: string | null;
          sitter_id?: string;
          start_at?: string;
          status?: Database['public']['Enums']['time_off_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sitter_time_off_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sitter_time_off_sitter_id_organization_id_fkey';
            columns: ['sitter_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      visits: {
        Row: {
          booking_id: string;
          cancelled_at: string | null;
          care_time_id: string | null;
          check_in_at: string | null;
          check_in_lat: number | null;
          check_in_lng: number | null;
          check_out_at: string | null;
          check_out_lat: number | null;
          check_out_lng: number | null;
          created_at: string;
          id: string;
          late_cancellation: boolean;
          on_the_way_at: string | null;
          organization_id: string;
          scheduled_end: string;
          scheduled_start: string;
          sitter_id: string | null;
          slot_start: string;
          started_at: string | null;
          status: Database['public']['Enums']['visit_status'];
          status_line: string | null;
          summary_note: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id: string;
          cancelled_at?: string | null;
          care_time_id?: string | null;
          check_in_at?: string | null;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_out_at?: string | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          created_at?: string;
          id?: string;
          late_cancellation?: boolean;
          on_the_way_at?: string | null;
          organization_id?: string;
          scheduled_end: string;
          scheduled_start: string;
          sitter_id?: string | null;
          slot_start: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['visit_status'];
          status_line?: string | null;
          summary_note?: string | null;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          cancelled_at?: string | null;
          care_time_id?: string | null;
          check_in_at?: string | null;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_out_at?: string | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          created_at?: string;
          id?: string;
          late_cancellation?: boolean;
          on_the_way_at?: string | null;
          organization_id?: string;
          scheduled_end?: string;
          scheduled_start?: string;
          sitter_id?: string | null;
          slot_start?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['visit_status'];
          status_line?: string | null;
          summary_note?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'visits_booking_id_organization_id_fkey';
            columns: ['booking_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'visits_care_time_fkey';
            columns: ['care_time_id', 'booking_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'booking_care_times';
            referencedColumns: ['id', 'booking_id', 'organization_id'];
          },
          {
            foreignKeyName: 'visits_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visits_sitter_id_organization_id_fkey';
            columns: ['sitter_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      advance_visit: {
        Args: {
          p_lat?: number;
          p_lng?: number;
          p_status: Database['public']['Enums']['visit_status'];
          p_summary?: string;
          p_visit_id: string;
        };
        Returns: {
          booking_id: string;
          cancelled_at: string | null;
          care_time_id: string | null;
          check_in_at: string | null;
          check_in_lat: number | null;
          check_in_lng: number | null;
          check_out_at: string | null;
          check_out_lat: number | null;
          check_out_lng: number | null;
          created_at: string;
          id: string;
          late_cancellation: boolean;
          on_the_way_at: string | null;
          organization_id: string;
          scheduled_end: string;
          scheduled_start: string;
          sitter_id: string | null;
          slot_start: string;
          started_at: string | null;
          status: Database['public']['Enums']['visit_status'];
          status_line: string | null;
          summary_note: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'visits';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      apply_booking_plan: {
        Args: { p_booking_id: string; p_end_date?: string; p_sitter_id: string; p_visits: Json };
        Returns: number;
      };
      check_invite: {
        Args: { p_code: string };
        Returns: {
          email_locked: boolean;
          organization_name: string;
          role: Database['public']['Enums']['app_role'];
        }[];
      };
      list_expired_media: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          storage_path: string;
          thumb_path: string;
        }[];
      };
      my_conversations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          household_id: string;
          household_name: string;
          last_message_at: string;
          last_message_body: string;
          last_message_has_photo: boolean;
          last_sender_name: string;
          owner_name: string;
          unread: number;
        }[];
      };
      request_booking: {
        Args: {
          p_care_times?: Json;
          p_duration_minutes?: number;
          p_end_date?: string;
          p_notes?: string;
          p_pet_ids: string[];
          p_recurrence_rule?: string;
          p_service_type: Database['public']['Enums']['service_type'];
          p_start_date: string;
          p_window_end?: string;
          p_window_start?: string;
        };
        Returns: string;
      };
      reschedule_booking: {
        Args: {
          p_booking_id: string;
          p_care_times: Json;
          p_carry?: Json;
          p_from_date: string;
          p_schedule: Json;
          p_split: boolean;
          p_visits: Json;
        };
        Returns: string;
      };
      set_primary_emergency_contact: { Args: { p_contact_id: string }; Returns: undefined };
      store_generated_visits: { Args: { p_booking_id: string; p_visits: Json }; Returns: Json };
      unread_message_count: { Args: Record<PropertyKey, never>; Returns: number };
      update_visit_schedule: {
        Args: { p_end?: string; p_sitter_id?: string; p_start?: string; p_visit_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      allergy_severity: 'mild' | 'moderate' | 'severe';
      app_role: 'owner' | 'sitter' | 'admin';
      booking_status: 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
      care_event_type:
        'fed' | 'water' | 'pee' | 'poop' | 'walk' | 'meds_given' | 'play' | 'vomit' | 'note';
      change_request_status: 'requested' | 'approved' | 'declined' | 'withdrawn';
      incident_severity: 'minor' | 'moderate' | 'severe' | 'emergency';
      media_type: 'photo' | 'video';
      pet_sex: 'male' | 'female' | 'unknown';
      pet_species: 'dog' | 'cat';
      push_platform: 'ios' | 'android' | 'web';
      service_type: 'drop_in' | 'walk' | 'overnight' | 'multi_day';
      time_off_status: 'requested' | 'approved' | 'declined';
      visit_status:
        | 'scheduled'
        | 'on_the_way'
        | 'arrived'
        | 'in_progress'
        | 'completed'
        | 'missed'
        | 'cancelled';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      allergy_severity: ['mild', 'moderate', 'severe'],
      app_role: ['owner', 'sitter', 'admin'],
      booking_status: ['requested', 'confirmed', 'declined', 'cancelled', 'completed'],
      care_event_type: [
        'fed',
        'water',
        'pee',
        'poop',
        'walk',
        'meds_given',
        'play',
        'vomit',
        'note',
      ],
      change_request_status: ['requested', 'approved', 'declined', 'withdrawn'],
      incident_severity: ['minor', 'moderate', 'severe', 'emergency'],
      media_type: ['photo', 'video'],
      pet_sex: ['male', 'female', 'unknown'],
      pet_species: ['dog', 'cat'],
      push_platform: ['ios', 'android', 'web'],
      service_type: ['drop_in', 'walk', 'overnight', 'multi_day'],
      time_off_status: ['requested', 'approved', 'declined'],
      visit_status: [
        'scheduled',
        'on_the_way',
        'arrived',
        'in_progress',
        'completed',
        'missed',
        'cancelled',
      ],
    },
  },
} as const;
