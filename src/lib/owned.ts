import { supabaseServer } from "@/lib/supabase/server";

/** A pack the signed-in user owns (RLS does the ownership check), or null. */
export async function ownedPack(packId: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("packs")
    .select("id, status, stage, stage_error, brief_json, hooks_json, chosen_hooks, shot_list_json, app_id")
    .eq("id", packId)
    .maybeSingle();
  if (!data) return null;
  const { data: app } = await supabase.from("apps").select("name, icon_url").eq("id", data.app_id).single();
  return { ...data, app };
}
