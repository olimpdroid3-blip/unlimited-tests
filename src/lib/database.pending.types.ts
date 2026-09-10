import type { Database as BaseDatabase } from "@/lib/database.types";

type PendingDefensesTable = {
  Row: {
    id: string;
    screenshot_url: string;
    run_code: string;
    comment: string | null;
    submitted_nickname: string | null;
    telegram_user_id: number | null;
    telegram_chat_id: number;
    telegram_thread_id: number;
    source_form_id: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    screenshot_url: string | null;
    run_code: string | null;
    comment?: string | null;
    submitted_nickname?: string | null;
    telegram_user_id?: number | null;
    telegram_chat_id: number;
    telegram_thread_id?: number;
    source_form_id: string;
    created_at?: string;
  };
  Update: {
    id?: string;
    screenshot_url?: string;
    run_code?: string;
    comment?: string | null;
    submitted_nickname?: string | null;
    telegram_user_id?: number | null;
    telegram_chat_id?: number;
    telegram_thread_id?: number;
    source_form_id?: string;
    created_at?: string;
  };
  Relationships: [];
};

type FinalizePendingDefenseFunction = {
  Args: {
    p_pending_id: string;
    p_screenshot_url: string | null;
    p_run_code: string | null;
    p_player_id: string;
    p_comment: string | null;
    p_hero_ids: string[];
    p_mob_ids: string[];
  };
  Returns: string;
};

export type Database = Omit<BaseDatabase, "public"> & {
  public: Omit<BaseDatabase["public"], "Tables" | "Functions"> & {
    Tables: BaseDatabase["public"]["Tables"] & {
      pending_defenses: PendingDefensesTable;
    };
    Functions: BaseDatabase["public"]["Functions"] & {
      finalize_pending_defense: FinalizePendingDefenseFunction;
    };
  };
};
