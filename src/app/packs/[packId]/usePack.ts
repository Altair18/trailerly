"use client";

import { useCallback, useEffect, useState } from "react";
import type { Brief } from "@/lib/schemas/brief";
import type { ClipNotes } from "@/lib/schemas/clips";
import type { ChosenHooks, Hook } from "@/lib/schemas/hooks";
import type { OutputSpecId } from "@/lib/specs/outputs";
import type { Timeline } from "@/lib/timeline/schema";
import type { OutputStatus, PackStage, RuleResultValue, SourceStatus } from "@/types/db";

export interface PackState {
  id: string;
  stage: PackStage;
  stage_error: string | null;
  brief_json: Brief | null;
  hooks_json: Hook[] | null;
  chosen_hooks: ChosenHooks | null;
  app: { name: string; icon_url: string | null } | null;
  recording: {
    id: string;
    status: SourceStatus;
    error: string | null;
    file_name: string | null;
    duration_s: number | null;
    clips: Array<{ id: string; start: number; duration: number; url: string; poster: string; notes: ClipNotes | null }>;
  } | null;
  outputs: Array<{
    spec: OutputSpecId;
    status: OutputStatus;
    error: string | null;
    rules_status: RuleResultValue | null;
    draft_url: string | null;
    timeline: Timeline | null;
    rules: Array<{ rule: string; result: RuleResultValue; detail: string | null }>;
  }>;
}

/** Load a pack and keep polling every 2 s while `busy(pack)` is true. */
export function usePack(packId: string, busy: (p: PackState) => boolean) {
  const [pack, setPack] = useState<PackState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/packs/${packId}`);
    if (!res.ok) return setError(res.status === 404 ? "Pack not found." : "Couldn't load the pack.");
    setPack((await res.json()) as PackState);
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pack || !busy(pack)) return;
    const t = setTimeout(load, 2000);
    return () => clearTimeout(t);
  }, [pack, load, busy]);

  return { pack, error, reload: load };
}
