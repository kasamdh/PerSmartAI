export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
          created_at: string;
          duration_minutes: number | null;
          end_date: string | null;
          household_id: string;
          id: string;
          notes: string | null;
          organization_id: string;
          recurrence_rule: string | null;
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
          created_at?: string;
          duration_minutes?: number | null;
          end_date?: string | null;
          household_id: string;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          recurrence_rule?: string | null;
          service_type: Database['public']['Enums']['service_type'];
          sitter_id?: string | null;
          start_date: string;
          status?: Database['public']['Enums']['booking_status'];
          updated_at?: string;
          window_end?: string | null;
          window_start?: string | null;
        };
        Update: {
          created_at?: string;
          duration_minutes?: number | null;
          end_date?: string | null;
          household_id?: string;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          recurrence_rule?: string | null;
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
          organization_id: string;
          pet_id: string | null;
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
          organization_id?: string;
          pet_id?: string | null;
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
          organization_id?: string;
          pet_id?: string | null;
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
          id: string;
          organization_id: string;
          pet_id: string | null;
          storage_path: string;
          thumb_path: string | null;
          type: Database['public']['Enums']['media_type'];
          updated_at: string;
          visit_id: string;
        };
        ComputedFields: never;
        Insert: {
          caption?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id?: string;
          pet_id?: string | null;
          storage_path: string;
          thumb_path?: string | null;
          type: Database['public']['Enums']['media_type'];
          updated_at?: string;
          visit_id: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id?: string;
          pet_id?: string | null;
          storage_path?: string;
          thumb_path?: string | null;
          type?: Database['public']['Enums']['media_type'];
          updated_at?: string;
          visit_id?: string;
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
      messages: {
        Row: {
          body: string | null;
          created_at: string;
          household_id: string;
          id: string;
          media_id: string | null;
          organization_id: string;
          read_at: string | null;
          sender_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          household_id: string;
          id?: string;
          media_id?: string | null;
          organization_id?: string;
          read_at?: string | null;
          sender_id?: string | null;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          media_id?: string | null;
          organization_id?: string;
          read_at?: string | null;
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
            foreignKeyName: 'messages_media_id_organization_id_fkey';
            columns: ['media_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'media';
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
      organizations: {
        Row: {
          created_at: string;
          id: string;
          logo_url: string | null;
          name: string;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          timezone?: string;
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
          sitter_id: string;
          start_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_at: string;
          id?: string;
          organization_id?: string;
          reason?: string | null;
          sitter_id: string;
          start_at: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_at?: string;
          id?: string;
          organization_id?: string;
          reason?: string | null;
          sitter_id?: string;
          start_at?: string;
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
          check_in_at: string | null;
          check_in_lat: number | null;
          check_in_lng: number | null;
          check_out_at: string | null;
          check_out_lat: number | null;
          check_out_lng: number | null;
          created_at: string;
          id: string;
          organization_id: string;
          scheduled_end: string;
          scheduled_start: string;
          sitter_id: string | null;
          status: Database['public']['Enums']['visit_status'];
          summary_note: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id: string;
          check_in_at?: string | null;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_out_at?: string | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          created_at?: string;
          id?: string;
          organization_id?: string;
          scheduled_end: string;
          scheduled_start: string;
          sitter_id?: string | null;
          status?: Database['public']['Enums']['visit_status'];
          summary_note?: string | null;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          check_in_at?: string | null;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_out_at?: string | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          created_at?: string;
          id?: string;
          organization_id?: string;
          scheduled_end?: string;
          scheduled_start?: string;
          sitter_id?: string | null;
          status?: Database['public']['Enums']['visit_status'];
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
      check_invite: {
        Args: { p_code: string };
        Returns: {
          email_locked: boolean;
          organization_name: string;
          role: Database['public']['Enums']['app_role'];
        }[];
      };
      confirm_booking: { Args: { p_booking_id: string; p_sitter_id: string }; Returns: number };
    };
    Enums: {
      allergy_severity: 'mild' | 'moderate' | 'severe';
      app_role: 'owner' | 'sitter' | 'admin';
      booking_status: 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
      care_event_type:
        'fed' | 'water' | 'pee' | 'poop' | 'walk' | 'meds_given' | 'play' | 'vomit' | 'note';
      incident_severity: 'minor' | 'moderate' | 'severe' | 'emergency';
      media_type: 'photo' | 'video';
      pet_sex: 'male' | 'female' | 'unknown';
      pet_species: 'dog' | 'cat';
      push_platform: 'ios' | 'android' | 'web';
      service_type: 'drop_in' | 'walk' | 'overnight' | 'multi_day';
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
      incident_severity: ['minor', 'moderate', 'severe', 'emergency'],
      media_type: ['photo', 'video'],
      pet_sex: ['male', 'female', 'unknown'],
      pet_species: ['dog', 'cat'],
      push_platform: ['ios', 'android', 'web'],
      service_type: ['drop_in', 'walk', 'overnight', 'multi_day'],
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
