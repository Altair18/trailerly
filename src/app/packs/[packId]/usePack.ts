"use client";

import { useCallback, useEffect, useState } from "react";
import type { Brief } from "@/lib/schemas/brief";
import type { ClipNotes } from "@/lib/schemas/clips";
import type { ChosenHooks, Hook } from "@/lib/schemas/hooks";
import type { ShotList } from "@/lib/schemas/shotlist";
import type { OutputSpecId } from "@/lib/specs/outputs";
import type { StillId } from "@/lib/specs/stills";
import type { Timeline } from "@/lib/timeline/schema";
import type { OutputStatus, PackStage, RuleResultValue, SourceStatus } from "@/types/db";

export interface PackState {
  id: string;
  stage: PackStage;
  stage_error: string | null;
  brief_json: Brief | null;
  hooks_json: Hook[] | null;
  chosen_hooks: ChosenHooks | null;
  shot_list_json: ShotList | null;
  app: { name: string; icon_url: string | null } | null;
  recording: {
    id: string;
    status: SourceStatus;
    error: string | null;
    file_name: string | null;
    duration_s: number | null;
    clips: Array<{ id: string; start: number; duration: number; url: string; poster: string; notes: ClipNotes | null; idle: Array<{ start: number; duration: number }> }>;
  } | null;
  outputs: Array<{
    spec: OutputSpecId;
    status: OutputStatus;
    error: string | null;
    rules_status: RuleResultValue | null;
    draft_url: string | null;
    timeline: Timeline | null;
    rules: Array<{ rule: string; result: RuleResultValue; detail: string | null }>;
    /** iOS 27 stills taken from this output (header and search only). */
    stills: Array<{ id: StillId; label: string; size: string; fileName: string; url: string }>;
  }>;
  /** App Store screenshot ids -> URLs, for screenshot segments in the player. */
  images: Record<string, string>;
}

/** Load a pack and keep polling every 2 s while `busy(pack)` is true. */
export function usePack(packId: string, busy: (p: PackState) => boolean) {
  const [pack, setPack] = useState<PackState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/packs/${packId}`);
    if (!res.ok) return setError(res.status === 404 ? "Pack not found." : "Couldn't load the pack.");
    const next = (await res.json()) as PackState;
    // Every load signs the media again, so each URL comes back with a new token. Keep the URL already on the
    // page when the file is the same, or each poll would swap every video's src and restart it.
    setPack((prev) => (prev ? keepSignedUrls(prev, next) : next));
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll on a timer while busy rather than after each change: a poll that finds nothing new keeps the same pack
  // object, so an effect keyed on the pack would never schedule the next one.
  const isBusy = !!pack && busy(pack);
  useEffect(() => {
    if (!isBusy) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [isBusy, load]);

  return { pack, error, reload: load };
}

/** The file a signed URL points at, without its token. */
function fileOf(url: string): string | null {
  if (!/^https?:\/\//.test(url)) return null;
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return null;
  }
}

/** `next`, with every URL that points at the same file as the one at the same place in `prev` kept from `prev`. */
export function keepSignedUrls<T>(prev: T, next: T): T {
  if (typeof next === "string" && typeof prev === "string") {
    if (prev === next) return prev;
    const a = fileOf(prev);
    return (a && a === fileOf(next) ? prev : next) as T;
  }
  if (Array.isArray(next) && Array.isArray(prev)) {
    const out = next.map((v, i) => (i < prev.length ? keepSignedUrls(prev[i], v) : v));
    return (out.every((v, i) => v === prev[i]) && out.length === prev.length ? prev : out) as T;
  }
  if (next && prev && typeof next === "object" && typeof prev === "object") {
    const p = prev as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    let same = Object.keys(p).length === Object.keys(next).length;
    for (const [k, v] of Object.entries(next)) {
      out[k] = k in p ? keepSignedUrls(p[k], v) : v;
      if (out[k] !== p[k]) same = false;
    }
    return (same ? prev : out) as T;
  }
  return next;
}
