import type { PackStage } from "@/types/db";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function setStage(packId: string, stage: PackStage, error?: string): Promise<void> {
  const { error: dbError } = await supabaseAdmin()
    .from("packs")
    .update({ stage, stage_error: error ?? null })
    .eq("id", packId);
  if (dbError) throw dbError;
}

export async function loadPackWithApp(packId: string) {
  const db = supabaseAdmin();
  const { data: pack, error } = await db.from("packs").select("*").eq("id", packId).single();
  if (error) throw error;
  const { data: app, error: appError } = await db.from("apps").select("*").eq("id", pack.app_id).single();
  if (appError) throw appError;
  return { pack, app };
}
