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
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          chapter: string | null
          created_at: string
          id: string
          level: string | null
          mode: Database["public"]["Enums"]["ai_conversation_mode"]
          student_id: string
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          chapter?: string | null
          created_at?: string
          id?: string
          level?: string | null
          mode?: Database["public"]["Enums"]["ai_conversation_mode"]
          student_id: string
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          chapter?: string | null
          created_at?: string
          id?: string
          level?: string | null
          mode?: Database["public"]["Enums"]["ai_conversation_mode"]
          student_id?: string
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_exams: {
        Row: {
          answers: Json | null
          chapter: string | null
          created_at: string
          duration_min: number
          finished_at: string | null
          grading: Json | null
          id: string
          level: string | null
          questions: Json
          score: number | null
          started_at: string
          student_id: string
          subject: string
        }
        Insert: {
          answers?: Json | null
          chapter?: string | null
          created_at?: string
          duration_min?: number
          finished_at?: string | null
          grading?: Json | null
          id?: string
          level?: string | null
          questions: Json
          score?: number | null
          started_at?: string
          student_id: string
          subject: string
        }
        Update: {
          answers?: Json | null
          chapter?: string | null
          created_at?: string
          duration_min?: number
          finished_at?: string | null
          grading?: Json | null
          id?: string
          level?: string | null
          questions?: Json
          score?: number | null
          started_at?: string
          student_id?: string
          subject?: string
        }
        Relationships: []
      }
      ai_exercises: {
        Row: {
          created_at: string
          difficulty: number
          generated_exercise: Json
          id: string
          level: Database["public"]["Enums"]["school_level"]
          source_content: string | null
          source_type: Database["public"]["Enums"]["ai_source_type"]
          student_id: string
          subject: string
        }
        Insert: {
          created_at?: string
          difficulty?: number
          generated_exercise: Json
          id?: string
          level: Database["public"]["Enums"]["school_level"]
          source_content?: string | null
          source_type?: Database["public"]["Enums"]["ai_source_type"]
          student_id: string
          subject: string
        }
        Update: {
          created_at?: string
          difficulty?: number
          generated_exercise?: Json
          id?: string
          level?: Database["public"]["Enums"]["school_level"]
          source_content?: string | null
          source_type?: Database["public"]["Enums"]["ai_source_type"]
          student_id?: string
          subject?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          hint_level: number | null
          id: string
          image_url: string | null
          parts: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          hint_level?: number | null
          id?: string
          image_url?: string | null
          parts?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          hint_level?: number | null
          id?: string
          image_url?: string | null
          parts?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_quizzes: {
        Row: {
          chapter: string | null
          completed_at: string | null
          created_at: string
          id: string
          level: Database["public"]["Enums"]["school_level"]
          questions: Json
          score: number | null
          student_id: string
          subject: string
        }
        Insert: {
          chapter?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          level: Database["public"]["Enums"]["school_level"]
          questions: Json
          score?: number | null
          student_id: string
          subject: string
        }
        Update: {
          chapter?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["school_level"]
          questions?: Json
          score?: number | null
          student_id?: string
          subject?: string
        }
        Relationships: []
      }
      ai_revision_sheets: {
        Row: {
          chapter: string | null
          content_markdown: string
          conversation_id: string | null
          created_at: string
          id: string
          student_id: string
          subject: string | null
          title: string
        }
        Insert: {
          chapter?: string | null
          content_markdown: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          student_id: string
          subject?: string | null
          title: string
        }
        Update: {
          chapter?: string | null
          content_markdown?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          student_id?: string
          subject?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_revision_sheets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_submissions: {
        Row: {
          ai_feedback: string | null
          exercise_id: string
          id: string
          is_correct: boolean | null
          score: number | null
          student_answer: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          ai_feedback?: string | null
          exercise_id: string
          id?: string
          is_correct?: boolean | null
          score?: number | null
          student_answer: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          ai_feedback?: string | null
          exercise_id?: string
          id?: string
          is_correct?: boolean | null
          score?: number | null
          student_answer?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_submissions_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "ai_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          payment_id: string | null
          progress_pct: number
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          payment_id?: string | null
          progress_pct?: number
          student_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          payment_id?: string | null
          progress_pct?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reviews: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string
          id: string
          rating: number
          student_id: string
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string
          id?: string
          rating: number
          student_id: string
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string
          id?: string
          rating?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_videos: {
        Row: {
          course_id: string
          created_at: string
          duration_sec: number | null
          id: string
          is_free_preview: boolean
          order_index: number
          title: string
          video_url: string
        }
        Insert: {
          course_id: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          is_free_preview?: boolean
          order_index?: number
          title: string
          video_url: string
        }
        Update: {
          course_id?: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          is_free_preview?: boolean
          order_index?: number
          title?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_videos_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          enrolled_count: number
          id: string
          language: Database["public"]["Enums"]["language_code"]
          level: Database["public"]["Enums"]["school_level"]
          price: number
          price_type: Database["public"]["Enums"]["price_type"]
          rating_avg: number
          status: Database["public"]["Enums"]["course_status"]
          subject: string
          teacher_id: string
          thumbnail_url: string | null
          title: string
          trailer_video_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enrolled_count?: number
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          level: Database["public"]["Enums"]["school_level"]
          price?: number
          price_type?: Database["public"]["Enums"]["price_type"]
          rating_avg?: number
          status?: Database["public"]["Enums"]["course_status"]
          subject: string
          teacher_id: string
          thumbnail_url?: string | null
          title: string
          trailer_video_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enrolled_count?: number
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          level?: Database["public"]["Enums"]["school_level"]
          price?: number
          price_type?: Database["public"]["Enums"]["price_type"]
          rating_avg?: number
          status?: Database["public"]["Enums"]["course_status"]
          subject?: string
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
          trailer_video_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_countdowns: {
        Row: {
          exam: Database["public"]["Enums"]["exam_target"]
          exam_date: string
          id: string
          year: number
        }
        Insert: {
          exam: Database["public"]["Enums"]["exam_target"]
          exam_date: string
          id?: string
          year: number
        }
        Update: {
          exam?: Database["public"]["Enums"]["exam_target"]
          exam_date?: string
          id?: string
          year?: number
        }
        Relationships: []
      }
      gamification: {
        Row: {
          badges: Json
          chapters_completed: Json
          last_practice_date: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          badges?: Json
          chapters_completed?: Json
          last_practice_date?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          badges?: Json
          chapters_completed?: Json
          last_practice_date?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_sessions: {
        Row: {
          allow_recording: boolean
          created_at: string
          daily_room_url: string | null
          duration_min: number
          id: string
          level: Database["public"]["Enums"]["school_level"]
          max_students: number
          price_per_student: number
          recording_url: string | null
          scheduled_at: string
          session_type: Database["public"]["Enums"]["session_type"]
          status: Database["public"]["Enums"]["session_status"]
          subject: string
          teacher_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          allow_recording?: boolean
          created_at?: string
          daily_room_url?: string | null
          duration_min?: number
          id?: string
          level: Database["public"]["Enums"]["school_level"]
          max_students?: number
          price_per_student: number
          recording_url?: string | null
          scheduled_at: string
          session_type?: Database["public"]["Enums"]["session_type"]
          status?: Database["public"]["Enums"]["session_status"]
          subject: string
          teacher_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          allow_recording?: boolean
          created_at?: string
          daily_room_url?: string | null
          duration_min?: number
          id?: string
          level?: Database["public"]["Enums"]["school_level"]
          max_students?: number
          price_per_student?: number
          recording_url?: string | null
          scheduled_at?: string
          session_type?: Database["public"]["Enums"]["session_type"]
          status?: Database["public"]["Enums"]["session_status"]
          subject?: string
          teacher_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      parent_child_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          status: Database["public"]["Enums"]["link_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          status?: Database["public"]["Enums"]["link_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          status?: Database["public"]["Enums"]["link_status"]
          student_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          chargily_checkout_id: string | null
          chargily_payment_url: string | null
          created_at: string
          currency: string
          id: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          paid_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Insert: {
          amount: number
          chargily_checkout_id?: string | null
          chargily_payment_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Update: {
          amount?: number
          chargily_checkout_id?: string | null
          chargily_payment_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          item_id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          id: string
          method: string | null
          paid_at: string | null
          requested_at: string
          status: string
          teacher_id: string
        }
        Insert: {
          amount: number
          id?: string
          method?: string | null
          paid_at?: string | null
          requested_at?: string
          status?: string
          teacher_id: string
        }
        Update: {
          amount?: number
          id?: string
          method?: string | null
          paid_at?: string | null
          requested_at?: string
          status?: string
          teacher_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          language: Database["public"]["Enums"]["language_code"]
          phone: string | null
          updated_at: string
          wilaya: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          language?: Database["public"]["Enums"]["language_code"]
          phone?: string | null
          updated_at?: string
          wilaya?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          phone?: string | null
          updated_at?: string
          wilaya?: string | null
        }
        Relationships: []
      }
      quiz_responses: {
        Row: {
          answer: string
          id: string
          is_correct: boolean
          quiz_id: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          answer: string
          id?: string
          is_correct?: boolean
          quiz_id: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          answer?: string
          id?: string
          is_correct?: boolean
          quiz_id?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "session_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          credit_amount: number
          id: string
          referred_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          created_at?: string
          credit_amount?: number
          id?: string
          referred_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          created_at?: string
          credit_amount?: number
          id?: string
          referred_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          session_id: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_bookings: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          mode: string
          payment_id: string | null
          session_id: string
          status: Database["public"]["Enums"]["booking_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          mode?: string
          payment_id?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          mode?: string
          payment_id?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_quizzes: {
        Row: {
          closed_at: string | null
          correct_answer: string
          id: string
          options: Json
          question: string
          sent_at: string
          session_id: string
        }
        Insert: {
          closed_at?: string | null
          correct_answer: string
          id?: string
          options: Json
          question: string
          sent_at?: string
          session_id: string
        }
        Update: {
          closed_at?: string | null
          correct_answer?: string
          id?: string
          options?: Json
          question?: string
          sent_at?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_quizzes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          session_id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          session_id: string
          student_id: string
          teacher_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          session_id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_summaries: {
        Row: {
          created_at: string
          id: string
          per_student: Json
          session_id: string
          stats: Json
          summary_markdown: string
        }
        Insert: {
          created_at?: string
          id?: string
          per_student?: Json
          session_id: string
          stats?: Json
          summary_markdown: string
        }
        Update: {
          created_at?: string
          id?: string
          per_student?: Json
          session_id?: string
          stats?: Json
          summary_markdown?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_waitlist: {
        Row: {
          created_at: string
          id: string
          notified_at: string | null
          preferred_slots: Json | null
          student_id: string
          subject: string | null
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified_at?: string | null
          preferred_slots?: Json | null
          student_id: string
          subject?: string | null
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notified_at?: string | null
          preferred_slots?: Json | null
          student_id?: string
          subject?: string | null
          teacher_id?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          created_at: string
          credits: number
          exam_target: Database["public"]["Enums"]["exam_target"]
          school_level: Database["public"]["Enums"]["school_level"] | null
          streak_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          exam_target?: Database["public"]["Enums"]["exam_target"]
          school_level?: Database["public"]["Enums"]["school_level"] | null
          streak_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          exam_target?: Database["public"]["Enums"]["exam_target"]
          school_level?: Database["public"]["Enums"]["school_level"] | null
          streak_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          recurring: boolean
          start_time: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          recurring?: boolean
          start_time: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          recurring?: boolean
          start_time?: string
          teacher_id?: string
        }
        Relationships: []
      }
      teacher_earnings: {
        Row: {
          amount: number
          created_at: string
          id: string
          net_amount: number
          payment_id: string
          platform_fee: number
          released_at: string | null
          status: Database["public"]["Enums"]["earning_status"]
          teacher_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          net_amount: number
          payment_id: string
          platform_fee?: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["earning_status"]
          teacher_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          net_amount?: number
          payment_id?: string
          platform_fee?: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["earning_status"]
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_earnings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_profiles: {
        Row: {
          allow_recording: boolean
          bio: string | null
          created_at: string
          diploma_url: string | null
          hourly_rate: number | null
          id_document_url: string | null
          levels: Database["public"]["Enums"]["school_level"][]
          rating_avg: number
          subjects: string[]
          total_students: number
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          allow_recording?: boolean
          bio?: string | null
          created_at?: string
          diploma_url?: string | null
          hourly_rate?: number | null
          id_document_url?: string | null
          levels?: Database["public"]["Enums"]["school_level"][]
          rating_avg?: number
          subjects?: string[]
          total_students?: number
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          allow_recording?: boolean
          bio?: string | null
          created_at?: string
          diploma_url?: string | null
          hourly_rate?: number | null
          id_document_url?: string | null
          levels?: Database["public"]["Enums"]["school_level"][]
          rating_avg?: number
          subjects?: string[]
          total_students?: number
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
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
      is_parent_of: {
        Args: { _parent: string; _student: string }
        Returns: boolean
      }
    }
    Enums: {
      ai_conversation_mode: "chat" | "exam"
      ai_source_type: "generated" | "from_photo" | "from_text"
      app_role: "student" | "teacher" | "parent" | "admin"
      booking_status: "booked" | "attended" | "no_show" | "cancelled"
      course_status: "draft" | "published" | "archived"
      earning_status: "pending" | "released" | "refunded"
      exam_target: "none" | "bem" | "bac"
      item_type: "course" | "session"
      language_code: "fr" | "ar"
      link_status: "pending" | "accepted" | "rejected"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      price_type: "series" | "per_session"
      report_status: "open" | "reviewed" | "resolved"
      school_level:
        | "primaire"
        | "cem_1"
        | "cem_2"
        | "cem_3"
        | "cem_4"
        | "lycee_1_tc"
        | "lycee_2_sciences"
        | "lycee_2_lettres"
        | "lycee_2_maths"
        | "lycee_2_gestion"
        | "lycee_2_langues"
        | "lycee_2_techmath"
        | "lycee_3_sciences"
        | "lycee_3_lettres"
        | "lycee_3_maths"
        | "lycee_3_gestion"
        | "lycee_3_langues"
        | "lycee_3_techmath"
        | "univ_1"
        | "univ_2"
        | "univ_3"
        | "autre"
      session_status: "scheduled" | "live" | "completed" | "cancelled"
      session_type: "solo" | "group"
      verification_status: "pending" | "verified" | "rejected"
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
      ai_conversation_mode: ["chat", "exam"],
      ai_source_type: ["generated", "from_photo", "from_text"],
      app_role: ["student", "teacher", "parent", "admin"],
      booking_status: ["booked", "attended", "no_show", "cancelled"],
      course_status: ["draft", "published", "archived"],
      earning_status: ["pending", "released", "refunded"],
      exam_target: ["none", "bem", "bac"],
      item_type: ["course", "session"],
      language_code: ["fr", "ar"],
      link_status: ["pending", "accepted", "rejected"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      price_type: ["series", "per_session"],
      report_status: ["open", "reviewed", "resolved"],
      school_level: [
        "primaire",
        "cem_1",
        "cem_2",
        "cem_3",
        "cem_4",
        "lycee_1_tc",
        "lycee_2_sciences",
        "lycee_2_lettres",
        "lycee_2_maths",
        "lycee_2_gestion",
        "lycee_2_langues",
        "lycee_2_techmath",
        "lycee_3_sciences",
        "lycee_3_lettres",
        "lycee_3_maths",
        "lycee_3_gestion",
        "lycee_3_langues",
        "lycee_3_techmath",
        "univ_1",
        "univ_2",
        "univ_3",
        "autre",
      ],
      session_status: ["scheduled", "live", "completed", "cancelled"],
      session_type: ["solo", "group"],
      verification_status: ["pending", "verified", "rejected"],
    },
  },
} as const
