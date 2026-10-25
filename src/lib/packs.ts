import type { PackStage } from "@/types/db";
import { Clips, type Clip } from "@/lib/schemas/clips";
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

/** Clips from the pack's most recent recording that finished preparing. */
export async function readyClips(packId: string): Promise<Clip[]> {
  const { data } = await supabaseAdmin()
    .from("sources")
    .select("clips_json")
    .eq("pack_id", packId)
    .eq("kind", "recording")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? Clips.parse(data.clips_json) : [];
}
