import { supabaseServer } from "@/lib/supabase/server";

/** The signed-in user for this request, or null. */
export async function currentUser() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
