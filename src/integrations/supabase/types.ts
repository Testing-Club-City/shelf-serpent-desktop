export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      book_copies: {
        Row: {
          book_code: string
          book_id: string | null
          condition: string | null
          copy_number: number
          created_at: string | null
          id: string
          legacy_book_id: number | null
          notes: string | null
          status: string | null
          tracking_code: string | null
          updated_at: string | null
        }
        Insert: {
          book_code: string
          book_id?: string | null
          condition?: string | null
          copy_number: number
          created_at?: string | null
          id?: string
          legacy_book_id?: number | null
          notes?: string | null
          status?: string | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Update: {
          book_code?: string
          book_id?: string | null
          condition?: string | null
          copy_number?: number
          created_at?: string | null
          id?: string
          legacy_book_id?: number | null
          notes?: string | null
          status?: string | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_copies_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_copies_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "migrated_books"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          acquisition_year: number | null
          author: string
          available_copies: number
          book_code: string | null
          category_id: string | null
          condition: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          genre: string | null
          id: string
          isbn: string | null
          legacy_book_id: number | null
          legacy_isbn: string | null
          publication_year: number | null
          publisher: string | null
          shelf_location: string | null
          status: Database["public"]["Enums"]["book_status"] | null
          title: string
          total_copies: number
          updated_at: string | null
        }
        Insert: {
          acquisition_year?: number | null
          author: string
          available_copies?: number
          book_code?: string | null
          category_id?: string | null
          condition?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          isbn?: string | null
          legacy_book_id?: number | null
          legacy_isbn?: string | null
          publication_year?: number | null
          publisher?: string | null
          shelf_location?: string | null
          status?: Database["public"]["Enums"]["book_status"] | null
          title: string
          total_copies?: number
          updated_at?: string | null
        }
        Update: {
          acquisition_year?: number | null
          author?: string
          available_copies?: number
          book_code?: string | null
          category_id?: string | null
          condition?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          isbn?: string | null
          legacy_book_id?: number | null
          legacy_isbn?: string | null
          publication_year?: number | null
          publisher?: string | null
          shelf_location?: string | null
          status?: Database["public"]["Enums"]["book_status"] | null
          title?: string
          total_copies?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      borrowings: {
        Row: {
          book_copy_id: string | null
          book_id: string
          borrowed_date: string | null
          borrower_type: string | null
          condition_at_issue: string | null
          condition_at_return: string | null
          copy_condition: string | null
          created_at: string | null
          due_date: string
          fine_amount: number | null
          fine_paid: boolean | null
          group_borrowing_id: string | null
          id: string
          is_lost: boolean | null
          issued_by: string | null
          notes: string | null
          return_notes: string | null
          returned_by: string | null
          returned_date: string | null
          staff_id: string | null
          status: Database["public"]["Enums"]["borrowing_status"] | null
          student_id: string | null
          tracking_code: string | null
          updated_at: string | null
        }
        Insert: {
          book_copy_id?: string | null
          book_id: string
          borrowed_date?: string | null
          borrower_type?: string | null
          condition_at_issue?: string | null
          condition_at_return?: string | null
          copy_condition?: string | null
          created_at?: string | null
          due_date: string
          fine_amount?: number | null
          fine_paid?: boolean | null
          group_borrowing_id?: string | null
          id?: string
          is_lost?: boolean | null
          issued_by?: string | null
          notes?: string | null
          return_notes?: string | null
          returned_by?: string | null
          returned_date?: string | null
          staff_id?: string | null
          status?: Database["public"]["Enums"]["borrowing_status"] | null
          student_id?: string | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Update: {
          book_copy_id?: string | null
          book_id?: string
          borrowed_date?: string | null
          borrower_type?: string | null
          condition_at_issue?: string | null
          condition_at_return?: string | null
          copy_condition?: string | null
          created_at?: string | null
          due_date?: string
          fine_amount?: number | null
          fine_paid?: boolean | null
          group_borrowing_id?: string | null
          id?: string
          is_lost?: boolean | null
          issued_by?: string | null
          notes?: string | null
          return_notes?: string | null
          returned_by?: string | null
          returned_date?: string | null
          staff_id?: string | null
          status?: Database["public"]["Enums"]["borrowing_status"] | null
          student_id?: string | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrowings_book_copy_id_fkey"
            columns: ["book_copy_id"]
            isOneToOne: false
            referencedRelation: "book_copies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrowings_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrowings_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "migrated_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrowings_group_borrowing_id_fkey"
            columns: ["group_borrowing_id"]
            isOneToOne: false
            referencedRelation: "group_borrowings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrowings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrowings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "migrated_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrowings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          academic_level_type: string | null
          class_name: string
          class_section: string | null
          created_at: string | null
          form_level: number
          id: string
          is_active: boolean | null
          max_books_allowed: number | null
          updated_at: string | null
        }
        Insert: {
          academic_level_type?: string | null
          class_name: string
          class_section?: string | null
          created_at?: string | null
          form_level: number
          id?: string
          is_active?: boolean | null
          max_books_allowed?: number | null
          updated_at?: string | null
        }
        Update: {
          academic_level_type?: string | null
          class_name?: string
          class_section?: string | null
          created_at?: string | null
          form_level?: number
          id?: string
          is_active?: boolean | null
          max_books_allowed?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_rate_limits: {
        Row: {
          count: number | null
          email: string
          last_attempt: string | null
        }
        Insert: {
          count?: number | null
          email: string
          last_attempt?: string | null
        }
        Update: {
          count?: number | null
          email?: string
          last_attempt?: string | null
        }
        Relationships: []
      }
      fine_settings: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          fine_type: string
          id: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          fine_type: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          fine_type?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fines: {
        Row: {
          amount: number
          borrower_type: string | null
          borrowing_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          fine_type: string
          id: string
          staff_id: string | null
          status: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          borrower_type?: string | null
          borrowing_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fine_type: string
          id?: string
          staff_id?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          borrower_type?: string | null
          borrowing_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fine_type?: string
          id?: string
          staff_id?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fines_borrowing_id_fkey"
            columns: ["borrowing_id"]
            isOneToOne: false
            referencedRelation: "borrowings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_borrowing_id_fkey"
            columns: ["borrowing_id"]
            isOneToOne: false
            referencedRelation: "migrated_borrowings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "migrated_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      group_borrowings: {
        Row: {
          book_copy_id: string | null
          book_id: string
          borrowed_date: string | null
          condition_at_issue: string | null
          condition_at_return: string | null
          created_at: string | null
          due_date: string
          fine_amount: number | null
          fine_paid: boolean | null
          id: string
          is_lost: boolean | null
          issued_by: string | null
          notes: string | null
          return_notes: string | null
          returned_by: string | null
          returned_date: string | null
          status: string | null
          student_count: number | null
          student_ids: string[] | null
          tracking_code: string | null
          updated_at: string | null
        }
        Insert: {
          book_copy_id?: string | null
          book_id: string
          borrowed_date?: string | null
          condition_at_issue?: string | null
          condition_at_return?: string | null
          created_at?: string | null
          due_date: string
          fine_amount?: number | null
          fine_paid?: boolean | null
          id?: string
          is_lost?: boolean | null
          issued_by?: string | null
          notes?: string | null
          return_notes?: string | null
          returned_by?: string | null
          returned_date?: string | null
          status?: string | null
          student_count?: number | null
          student_ids?: string[] | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Update: {
          book_copy_id?: string | null
          book_id?: string
          borrowed_date?: string | null
          condition_at_issue?: string | null
          condition_at_return?: string | null
          created_at?: string | null
          due_date?: string
          fine_amount?: number | null
          fine_paid?: boolean | null
          id?: string
          is_lost?: boolean | null
          issued_by?: string | null
          notes?: string | null
          return_notes?: string | null
          returned_by?: string | null
          returned_date?: string | null
          status?: string | null
          student_count?: number | null
          student_ids?: string[] | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_borrowings_book_copy_id_fkey"
            columns: ["book_copy_id"]
            isOneToOne: false
            referencedRelation: "book_copies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_borrowings_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_borrowings_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "migrated_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_borrowings_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_borrowings_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_metadata: {
        Row: {
          additional_info: Json | null
          id: string
          imported_at: string | null
          new_id: string
          old_id: string
          source_table: string
          table_name: string
        }
        Insert: {
          additional_info?: Json | null
          id?: string
          imported_at?: string | null
          new_id: string
          old_id: string
          source_table: string
          table_name: string
        }
        Update: {
          additional_info?: Json | null
          id?: string
          imported_at?: string | null
          new_id?: string
          old_id?: string
          source_table?: string
          table_name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          is_online: boolean | null
          last_name: string | null
          last_seen: string | null
          phone: string | null
          role: string
          suspended: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          is_online?: boolean | null
          last_name?: string | null
          last_seen?: string | null
          phone?: string | null
          role?: string
          suspended?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          is_online?: boolean | null
          last_name?: string | null
          last_seen?: string | null
          phone?: string | null
          role?: string
          suspended?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      school_terms: {
        Row: {
          academic_year: string
          created_at: string | null
          end_date: string
          id: string
          is_current: boolean | null
          start_date: string
          term_name: string
          updated_at: string | null
        }
        Insert: {
          academic_year: string
          created_at?: string | null
          end_date: string
          id?: string
          is_current?: boolean | null
          start_date: string
          term_name: string
          updated_at?: string | null
        }
        Update: {
          academic_year?: string
          created_at?: string | null
          end_date?: string
          id?: string
          is_current?: boolean | null
          start_date?: string
          term_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      screenshots: {
        Row: {
          created_at: string
          description: string | null
          id: number
          image_url: string
          test_step_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          image_url: string
          test_step_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          image_url?: string
          test_step_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screenshots_test_step_id_fkey"
            columns: ["test_step_id"]
            isOneToOne: false
            referencedRelation: "test_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string | null
          department: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          legacy_staff_id: number | null
          phone: string | null
          position: string | null
          staff_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          legacy_staff_id?: number | null
          phone?: string | null
          position?: string | null
          staff_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          legacy_staff_id?: number | null
          phone?: string | null
          position?: string | null
          staff_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          academic_year: string | null
          address: string | null
          admission_number: string
          class_grade: string
          class_id: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          enrollment_date: string | null
          first_name: string
          id: string
          is_repeating: boolean | null
          last_name: string
          legacy_student_id: number | null
          phone: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          academic_year?: string | null
          address?: string | null
          admission_number: string
          class_grade: string
          class_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          enrollment_date?: string | null
          first_name: string
          id?: string
          is_repeating?: boolean | null
          last_name: string
          legacy_student_id?: number | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_year?: string | null
          address?: string | null
          admission_number?: string
          class_grade?: string
          class_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          enrollment_date?: string | null
          first_name?: string
          id?: string
          is_repeating?: boolean | null
          last_name?: string
          legacy_student_id?: number | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases: {
        Row: {
          actual_result: string | null
          created_at: string
          description: string | null
          expected_result: string | null
          id: number
          status: string
          test_name: string
          test_result_id: number | null
          updated_at: string
        }
        Insert: {
          actual_result?: string | null
          created_at?: string
          description?: string | null
          expected_result?: string | null
          id?: number
          status: string
          test_name: string
          test_result_id?: number | null
          updated_at?: string
        }
        Update: {
          actual_result?: string | null
          created_at?: string
          description?: string | null
          expected_result?: string | null
          id?: number
          status?: string
          test_name?: string
          test_result_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_test_result_id_fkey"
            columns: ["test_result_id"]
            isOneToOne: false
            referencedRelation: "test_results"
            referencedColumns: ["id"]
          },
        ]
      }
      test_data: {
        Row: {
          created_at: string
          data_key: string
          data_value: string | null
          id: number
          test_step_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_key: string
          data_value?: string | null
          id?: number
          test_step_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_key?: string
          data_value?: string | null
          id?: number
          test_step_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_data_test_step_id_fkey"
            columns: ["test_step_id"]
            isOneToOne: false
            referencedRelation: "test_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      test_results: {
        Row: {
          created_at: string
          id: number
          result_id: string
          status: string
          test_date: string
          test_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          result_id: string
          status: string
          test_date?: string
          test_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          result_id?: string
          status?: string
          test_date?: string
          test_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_steps: {
        Row: {
          created_at: string
          description: string | null
          id: number
          status: string
          step_name: string
          test_case_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          status: string
          step_name: string
          test_case_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          status?: string
          step_name?: string
          test_case_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_steps_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      theft_reports: {
        Row: {
          book_copy_id: string
          book_id: string
          borrowing_id: string
          created_at: string | null
          expected_tracking_code: string
          id: string
          investigation_notes: string | null
          reported_by: string | null
          reported_date: string
          resolved_by: string | null
          resolved_date: string | null
          returned_tracking_code: string
          status: string | null
          student_id: string
          theft_reason: string | null
          updated_at: string | null
        }
        Insert: {
          book_copy_id: string
          book_id: string
          borrowing_id: string
          created_at?: string | null
          expected_tracking_code: string
          id?: string
          investigation_notes?: string | null
          reported_by?: string | null
          reported_date?: string
          resolved_by?: string | null
          resolved_date?: string | null
          returned_tracking_code: string
          status?: string | null
          student_id: string
          theft_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          book_copy_id?: string
          book_id?: string
          borrowing_id?: string
          created_at?: string | null
          expected_tracking_code?: string
          id?: string
          investigation_notes?: string | null
          reported_by?: string | null
          reported_date?: string
          resolved_by?: string | null
          resolved_date?: string | null
          returned_tracking_code?: string
          status?: string | null
          student_id?: string
          theft_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "theft_reports_book_copy_id_fkey"
            columns: ["book_copy_id"]
            isOneToOne: false
            referencedRelation: "book_copies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theft_reports_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theft_reports_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "migrated_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theft_reports_borrowing_id_fkey"
            columns: ["borrowing_id"]
            isOneToOne: false
            referencedRelation: "borrowings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theft_reports_borrowing_id_fkey"
            columns: ["borrowing_id"]
            isOneToOne: false
            referencedRelation: "migrated_borrowings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theft_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theft_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theft_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "migrated_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theft_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      migrated_books: {
        Row: {
          author: string | null
          book_code: string | null
          id: string | null
          imported_at: string | null
          isbn: string | null
          old_book_id: string | null
          old_title: string | null
          title: string | null
        }
        Relationships: []
      }
      migrated_borrowings: {
        Row: {
          book_id: string | null
          borrowed_date: string | null
          due_date: string | null
          id: string | null
          imported_at: string | null
          old_borrowing_id: string | null
          returned_date: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["borrowing_status"] | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrowings_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrowings_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "migrated_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrowings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "migrated_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrowings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      migrated_students: {
        Row: {
          admission_number: string | null
          class_grade: string | null
          first_name: string | null
          id: string | null
          imported_at: string | null
          last_name: string | null
          old_member_id: string | null
          old_name: string | null
        }
        Relationships: []
      }
      theft_report_stats: {
        Row: {
          active_reports: number | null
          closed_reports: number | null
          investigating_reports: number | null
          reports_this_month: number | null
          reports_this_week: number | null
          resolved_reports: number | null
          total_reports: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_all_missing_classes: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      add_missing_class: {
        Args: {
          p_class_name: string
          p_form_level: number
          p_class_section: string
          p_max_books_allowed?: number
          p_is_active?: boolean
        }
        Returns: Json
      }
      check_auth_users_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_email_rate_limit: {
        Args: { email_address: string }
        Returns: boolean
      }
      clean_duplicate_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_librarian_profile: {
        Args: {
          user_id: string
          user_email: string
          first_name: string
          last_name: string
          phone_number: string
        }
        Returns: boolean
      }
      create_missing_book_copies: {
        Args: Record<PropertyKey, never>
        Returns: {
          book_id: string
          book_title: string
          copies_created: number
          book_code_generated: string
        }[]
      }
      create_notifications_table_if_not_exists: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      find_by_old_id: {
        Args: { p_table_name: string; p_old_id: string }
        Returns: string
      }
      force_delete_student_with_history: {
        Args: { student_id_param: string }
        Returns: undefined
      }
      generate_tracking_code: {
        Args: { book_code: string; copy_number: number; year?: number }
        Returns: string
      }
      generate_unique_book_code: {
        Args: { book_title?: string; book_id?: string }
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_old_id: {
        Args: { p_table_name: string; p_new_id: string }
        Returns: string
      }
      log_system_event: {
        Args: {
          p_action_type: string
          p_resource_type: string
          p_resource_id?: string
          p_details?: Json
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: string
      }
      record_migration_metadata: {
        Args: {
          p_table_name: string
          p_new_id: string
          p_old_id: string
          p_source_table: string
          p_additional_info?: Json
        }
        Returns: undefined
      }
      set_user_offline: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      sync_total_copies_with_actual: {
        Args: Record<PropertyKey, never>
        Returns: {
          book_id: string
          book_title: string
          old_total: number
          new_total: number
        }[]
      }
      update_book_copy_tracking_codes: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      book_status: "available" | "unavailable" | "damaged" | "lost"
      borrowing_status: "active" | "returned" | "overdue" | "lost"
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
      book_status: ["available", "unavailable", "damaged", "lost"],
      borrowing_status: ["active", "returned", "overdue", "lost"],
    },
  },
} as const
