import { supabaseAdmin } from "@/lib/supabase/admin";

export const MAX_AUTO_TRIES_PER_SCENE = 3;
export const FREE_USER_REGENERATIONS_PER_SCENE = 2;

export class BudgetExceededError extends Error {}

/** Throws if spending `pence` would take the pack over its cost budget. */
export async function assertBudget(packId: string, pence: number): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("packs")
    .select("cost_budget_pence, cost_spent_pence")
    .eq("id", packId)
    .single();
  if (error) throw error;
  if (data.cost_spent_pence + pence > data.cost_budget_pence) {
    throw new BudgetExceededError(`Pack ${packId} would exceed its budget.`);
  }
}

/** Log an API cost against the pack. TODO: make atomic with an RPC once real spend is flowing. */
export async function recordSpend(packId: string, pence: number): Promise<void> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("packs").select("cost_spent_pence").eq("id", packId).single();
  if (error) throw error;
  await db.from("packs").update({ cost_spent_pence: data.cost_spent_pence + pence }).eq("id", packId);
}
