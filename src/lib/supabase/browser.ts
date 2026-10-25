"use client";

import { createBrowserClient } from "@supabase/ssr";
import { cleanEnv } from "@/lib/clean-env";
import type { Database } from "@/types/db";

export function supabaseBrowser() {
  return createBrowserClient<Database>(
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}
