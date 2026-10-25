import type { Brief } from "@/lib/schemas/brief";
import type { ClipNotes } from "@/lib/schemas/clips";
import { MAX_SHOT_WORDS, type Shot, type ShotList } from "@/lib/schemas/shotlist";

export const SHOTLIST_SYSTEM = `You plan a phone screen recording for an app's App Store video.
Write 5 or 6 shots, in the order to record them in one take. Each shot is one instruction the developer follows
on their own phone, ${MAX_SHOT_WORDS} words at most, starting with a verb ("Add a coffee expense in one tap").
Open on the app's best moment, not a splash screen, login or settings. Cover the brief's main features.
Give each shot 2 to 6 seconds. Use demo content only: never ask for real names, contacts or messages.
Return JSON: {"shots": [{"action": "...", "seconds": n, "feature": "..." or null}]}.`;

/** Checks to do before recording; shown with the shot list. */
export const RECORDING_TIPS = [
  "Turn on Do Not Disturb so no notifications appear.",
  "Use demo data: no real names, chats or contacts.",
  "Set the clock to 9:41 and charge the battery if you can.",
  "Use the built-in screen recorder and record all the shots in one go.",
];

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Keep 5 or 6 usable shots: short actions, sane lengths. */
export function tidyShots(shots: Shot[]): Shot[] {
  return shots
    .filter((s) => s.action.trim() && words(s.action) <= MAX_SHOT_WORDS)
    .map((s) => ({ ...s, action: s.action.trim(), seconds: Math.min(6, Math.max(2, Math.round(s.seconds))) }))
    .slice(0, 6);
}

export async function writeShotList(
  brief: Brief,
  appName: string,
  generate: (prompt: string) => Promise<{ shots: Shot[] }>,
): Promise<ShotList> {
  let kept: Shot[] = [];
  for (let attempt = 0; attempt < 2 && kept.length < 4; attempt++) {
    const { shots } = await generate(
      JSON.stringify({
        app: appName,
        what_it_does: brief.what_it_does,
        features: brief.features,
        audience: brief.audience,
        note: attempt > 0 ? `Keep every action to ${MAX_SHOT_WORDS} words or fewer.` : undefined,
      }),
    );
    kept = tidyShots(shots);
  }
  if (kept.length === 0) throw new Error("No usable shots in the reply.");
  return { shots: kept };
}

export interface ShotCoverage {
  shot: Shot;
  /** 1-based shot number. */
  n: number;
  clipIds: string[];
}

/** Which clips the clip check matched to each shot; an empty list means the shot is missing. */
export function shotCoverage(list: ShotList, clips: { id: string; notes?: ClipNotes | null }[]): ShotCoverage[] {
  return list.shots.map((shot, i) => ({
    shot,
    n: i + 1,
    clipIds: clips.filter((c) => c.notes?.shot === i + 1).map((c) => c.id),
  }));
}
