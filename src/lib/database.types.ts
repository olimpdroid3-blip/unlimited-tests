// Database types for the GvG Supabase project (aabaapmktkfwmvgcirxb).
// Generated from the PostgREST schema of that project.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      battle_power: {
        Row: {
          created_at: string
          id: string
          nickname: string
          power1: number | null
          power2: number | null
          power3: number | null
          power4: number | null
          power5: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nickname: string
          power1?: number | null
          power2?: number | null
          power3?: number | null
          power4?: number | null
          power5?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string
          power1?: number | null
          power2?: number | null
          power3?: number | null
          power4?: number | null
          power5?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      defense_heroes: {
        Row: {
          created_at: string
          defense_id: string
          hero_id: string
          id: string
          position: number | null
        }
        Insert: {
          created_at?: string
          defense_id: string
          hero_id: string
          id?: string
          position?: number | null
        }
        Update: {
          created_at?: string
          defense_id?: string
          hero_id?: string
          id?: string
          position?: number | null
        }
        Relationships: []
      }
      defense_mobs: {
        Row: {
          created_at: string
          defense_id: string
          id: string
          mob_id: string
          position: number
        }
        Insert: {
          created_at?: string
          defense_id: string
          id?: string
          mob_id: string
          position: number
        }
        Update: {
          created_at?: string
          defense_id?: string
          id?: string
          mob_id?: string
          position?: number
        }
        Relationships: []
      }
      defenses: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          player_id: string | null
          run_code: string | null
          screenshot_url: string | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          player_id?: string | null
          run_code?: string | null
          screenshot_url?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          player_id?: string | null
          run_code?: string | null
          screenshot_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      heroes: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          name_en: string
          name_ru: string
          source_icon_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          name_en: string
          name_ru: string
          source_icon_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          name_en?: string
          name_ru?: string
          source_icon_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mobs: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          mob_type: string
          name: string
          rarity: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          image_url?: string | null
          mob_type?: string
          name: string
          rarity?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          mob_type?: string
          name?: string
          rarity?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      player_mob_levels: {
        Row: {
          level: number
          mob_id: string
          player_id: string
          updated_at: string
        }
        Insert: {
          level: number
          mob_id: string
          player_id: string
          updated_at?: string
        }
        Update: {
          level?: number
          mob_id?: string
          player_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_sources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          telegram_chat_id: number
          telegram_thread_id: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          telegram_chat_id: number
          telegram_thread_id?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          telegram_chat_id?: number
          telegram_thread_id?: number
        }
        Relationships: []
      }
      telegram_video_messages: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          message_date: string | null
          message_type: string
          notes: string | null
          telegram_chat_id: number
          telegram_message_id: number
          telegram_message_link: string | null
          telegram_thread_id: number | null
          telegram_uploader_custom_title: string | null
          telegram_uploader_name: string | null
          telegram_uploader_user_id: number | null
          telegram_user_id: number | null
          telegram_username: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          message_date?: string | null
          message_type?: string
          notes?: string | null
          telegram_chat_id: number
          telegram_message_id: number
          telegram_message_link?: string | null
          telegram_thread_id?: number | null
          telegram_uploader_custom_title?: string | null
          telegram_uploader_name?: string | null
          telegram_uploader_user_id?: number | null
          telegram_user_id?: number | null
          telegram_username?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          message_date?: string | null
          message_type?: string
          notes?: string | null
          telegram_chat_id?: number
          telegram_message_id?: number
          telegram_message_link?: string | null
          telegram_thread_id?: number | null
          telegram_uploader_custom_title?: string | null
          telegram_uploader_name?: string | null
          telegram_uploader_user_id?: number | null
          telegram_user_id?: number | null
          telegram_username?: string | null
        }
        Relationships: []
      }
      telegram_video_pending_heroes: {
        Row: {
          bot_message_ids: number[]
          confirmed_hero_ids: string[]
          created_at: string
          expires_at: string
          id: string
          prompt_message_id: number | null
          status: string
          suggestion_hero_ids: string[]
          telegram_chat_id: number
          telegram_thread_id: number | null
          telegram_user_id: number
          unresolved_token: string | null
          updated_at: string
          video_message_id: number
          video_row_id: string | null
        }
        Insert: {
          bot_message_ids: number[]
          confirmed_hero_ids: string[]
          created_at?: string
          expires_at?: string
          id?: string
          prompt_message_id?: number | null
          status?: string
          suggestion_hero_ids: string[]
          telegram_chat_id: number
          telegram_thread_id?: number | null
          telegram_user_id: number
          unresolved_token?: string | null
          updated_at?: string
          video_message_id: number
          video_row_id?: string | null
        }
        Update: {
          bot_message_ids?: number[]
          confirmed_hero_ids?: string[]
          created_at?: string
          expires_at?: string
          id?: string
          prompt_message_id?: number | null
          status?: string
          suggestion_hero_ids?: string[]
          telegram_chat_id?: number
          telegram_thread_id?: number | null
          telegram_user_id?: number
          unresolved_token?: string | null
          updated_at?: string
          video_message_id?: number
          video_row_id?: string | null
        }
        Relationships: []
      }
      towers: {
        Row: {
          awakenings: string | null
          breached: boolean
          nickname: string | null
          notes: string | null
          tower_id: string
          updated_at: string
        }
        Insert: {
          awakenings?: string | null
          breached?: boolean
          nickname?: string | null
          notes?: string | null
          tower_id: string
          updated_at?: string
        }
        Update: {
          awakenings?: string | null
          breached?: boolean
          nickname?: string | null
          notes?: string | null
          tower_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      towers_archive: {
        Row: {
          archived_at: string
          awakenings: string | null
          breached: boolean
          id: string
          nickname: string | null
          notes: string | null
          original_updated_at: string | null
          tower_id: string
        }
        Insert: {
          archived_at?: string
          awakenings?: string | null
          breached?: boolean
          id?: string
          nickname?: string | null
          notes?: string | null
          original_updated_at?: string | null
          tower_id: string
        }
        Update: {
          archived_at?: string
          awakenings?: string | null
          breached?: boolean
          id?: string
          nickname?: string | null
          notes?: string | null
          original_updated_at?: string | null
          tower_id?: string
        }
        Relationships: []
      }
      video_heroes: {
        Row: {
          created_at: string
          hero_id: string
          id: string
          video_message_id: string
        }
        Insert: {
          created_at?: string
          hero_id: string
          id?: string
          video_message_id: string
        }
        Update: {
          created_at?: string
          hero_id?: string
          id?: string
          video_message_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_defense_with_details: {
        Args: {
          p_comment: string | null
          p_hero_ids: string[] | null
          p_mob_ids: string[] | null
          p_player_id: string | null
          p_run_code: string | null
          p_screenshot_url: string | null
        }
        Returns: unknown
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
