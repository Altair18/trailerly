// Hand-written to match supabase/migrations/0001_init.sql.
// Replace with `supabase gen types typescript` once a project is linked.

import type { OutputSpecId } from "@/lib/specs/outputs";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PackStatus = "draft" | "paid" | "rendering" | "ready" | "failed";
export type PackStage = "ingesting" | "writing_brief" | "writing_hooks" | "review" | "error";
export type SourceKind = "recording" | "screenshot";
export type RuleResultValue = "pass" | "warn" | "block";

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type UserRow = { id: string; email: string; created_at: string };
export type AppRow = {
  id: string; user_id: string; store: "apple"; store_id: string; country: string;
  name: string; icon_url: string | null; listing_json: Json; fetched_at: string;
};
export type PackRow = {
  id: string; app_id: string; status: PackStatus; stage: PackStage; stage_error: string | null;
  brief_json: Json | null; hooks_json: Json | null; chosen_hooks: Json | null;
  price_pence: number; cost_budget_pence: number; cost_spent_pence: number; created_at: string;
};
export type SourceRow = {
  id: string; pack_id: string; kind: SourceKind; url: string; duration_s: number | null; clips_json: Json | null;
};
export type OutputRow = {
  id: string; pack_id: string; spec: OutputSpecId; timeline_json: Json | null;
  draft_url: string | null; final_url: string | null; rules_status: RuleResultValue | null;
};
export type SceneRow = {
  id: string; output_id: string; prompt: string; prompt_hash: string; model: string | null;
  seconds: number; tries: number; cost_pence: number; clip_url: string | null; qa_status: RuleResultValue | null;
};
export type RuleResultRow = {
  id: string; output_id: string; rule: string; result: RuleResultValue; detail: string | null;
  overridden_by_user: boolean; created_at: string;
};
export type PaymentRow = {
  id: string; pack_id: string; stripe_session_id: string; amount_pence: number; status: string; created_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: Table<UserRow, "id" | "email">;
      apps: Table<AppRow, "user_id" | "store_id" | "country" | "name" | "listing_json">;
      packs: Table<PackRow, "app_id" | "price_pence" | "cost_budget_pence">;
      sources: Table<SourceRow, "pack_id" | "kind" | "url">;
      outputs: Table<OutputRow, "pack_id" | "spec">;
      scenes: Table<SceneRow, "output_id" | "prompt" | "prompt_hash" | "seconds">;
      rule_results: Table<RuleResultRow, "output_id" | "rule" | "result">;
      payments: Table<PaymentRow, "pack_id" | "stripe_session_id" | "amount_pence" | "status">;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      pack_status: PackStatus;
      pack_stage: PackStage;
      source_kind: SourceKind;
      output_spec: OutputSpecId;
      rule_result: RuleResultValue;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
