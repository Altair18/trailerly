import { z } from "zod";
import { isPrivate, type Clip } from "@/lib/schemas/clips";
import type { Screenshot } from "@/lib/media/screenshots";
import { isLandscape, type OutputSpec } from "@/lib/specs/outputs";
import { MAX_BEAT_SECONDS, MAX_OUTRO_SECONDS } from "./pacing";
import { CAPTION_WORDS, MAX_OVERLAY_CHARS, MAX_OVERLAY_WORDS, readSeconds } from "./enforce";
import { dropDangling, hookLine, shortLine } from "./preview";
import type { Segment, Timeline } from "./schema";

// Proven cut structures. The model picks one and fills its slots (which shot plays in each beat, and a short
// caption); code turns that into a timeline with the timing worked out, so the plan is valid by construction.
// That is a small, constrained job the fast model does well. Several templates per shape keep packs from all
// looking alike, and A/B variants can later test templates against each other.

export type BeatRole = "hook" | "problem" | "feature" | "payoff" | "close";

export interface Beat {
  role: BeatRole;
  /** Share of the video's length (relative to the other beats). */
  weight: number;
  /** True when this beat carries a caption the model writes. */
  caption: boolean;
  /** What should be on screen, for the model. */
  note: string;
}

export interface CutTemplate {
  id: string;
  name: string;
  /** Portrait: App Store preview and social ads. Landscape: iOS 27 header and search. */
  shape: "portrait" | "landscape";
  idea: string;
  beats: Beat[];
  /** Social ads end on a full-screen call-to-action card where the spec allows one. */
  endCard?: boolean;
}

const hook = (weight: number, note = "the strongest, busiest moment: the promise in one look"): Beat => ({ role: "hook", weight, caption: false, note });
const close = (weight: number, note = "a calm, clear screen to sit under the app's name"): Beat => ({ role: "close", weight, caption: false, note });
const beat = (role: BeatRole, weight: number, note: string): Beat => ({ role, weight, caption: true, note });

// Landscape weights follow top apps' App Store videos: no beat over 5 s and a logo close of 2 s at the 12 s
// header and 10 s search lengths (see render-lint).
export const TEMPLATES: CutTemplate[] = [
  // Portrait (App Store preview), after the agency benchmark: every agency preview runs 25-30 s as a hook that names
  // the viewer's problem or wish, about three benefit beats of 4-5 s, a "life after" payoff and a closing line.
  {
    id: "promise-tour",
    name: "Promise, then prove it",
    shape: "portrait",
    idea: "Open on the promise, three benefits that back it up (one per beat), then life with the app.",
    beats: [hook(3), beat("feature", 5, "the main benefit, in use"), beat("feature", 5, "a second benefit"), beat("feature", 5, "a third benefit"), beat("payoff", 4.5, "the result: life with the app"), close(3)],
    endCard: true,
  },
  {
    id: "problem-fix",
    name: "Problem, fix, payoff",
    shape: "portrait",
    idea: "Name the pain in the hook, show the app fixing it in a few taps, two more reasons, end on the result.",
    beats: [hook(3, "the moment that shows the problem the app solves"), beat("feature", 5.5, "the core action that fixes it"), beat("feature", 4.5, "a second reason to install"), beat("feature", 4.5, "a third reason"), beat("payoff", 5, "the result on screen: the problem gone"), close(3)],
    endCard: true,
  },
  {
    id: "rapid-list",
    name: "Rapid list",
    shape: "portrait",
    idea: "Fast cuts: four benefits, one short caption each, then the payoff.",
    beats: [hook(2.5), beat("feature", 4, "benefit 1"), beat("feature", 4, "benefit 2"), beat("feature", 4, "benefit 3"), beat("feature", 4, "benefit 4"), beat("payoff", 4, "the result"), close(2.5)],
    endCard: true,
  },
  {
    id: "hero-deep",
    name: "One hero feature",
    shape: "portrait",
    idea: "Spend most of the time on the app's best feature from start to finish, then two extras and the payoff.",
    beats: [hook(3), beat("feature", 5, "the hero feature, first steps"), beat("feature", 5, "the hero feature, its result"), beat("feature", 4.5, "a supporting benefit"), beat("payoff", 4.5, "the result: life with the app"), close(3)],
    endCard: true,
  },
  {
    id: "question-answer",
    name: "Question, answer",
    shape: "portrait",
    idea: "The hook asks a question; the next beat answers it on screen, then two quick proofs and the payoff.",
    beats: [hook(3, "a moment that sets up the question"), beat("payoff", 5, "the answer, shown in the app"), beat("feature", 4.5, "proof 1"), beat("feature", 4.5, "proof 2"), beat("payoff", 4.5, "the result"), close(3)],
    endCard: true,
  },
  {
    id: "before-after",
    name: "Before and after",
    shape: "portrait",
    idea: "Show the starting point (empty state, messy input), then the app's result, then two more benefits.",
    beats: [hook(3), beat("problem", 4, "before: the empty state or messy input"), beat("payoff", 5.5, "after: what the app turns it into"), beat("feature", 4.5, "another benefit"), beat("feature", 4.5, "one more benefit"), close(3)],
    endCard: true,
  },
  {
    id: "single-hero",
    name: "Single hero shot",
    shape: "landscape",
    idea: "One line held over the best moment, one caption beat, then the name.",
    beats: [hook(5), beat("feature", 5, "the feature the hook promises"), close(2)],
  },
  {
    id: "two-beat",
    name: "Two quick beats",
    shape: "landscape",
    idea: "Hook, then two short caption beats, then the name.",
    beats: [hook(4), beat("feature", 3, "feature 1"), beat("feature", 3, "feature 2"), close(2)],
  },
  {
    id: "calm-loop",
    name: "Calm loop",
    shape: "landscape",
    idea: "A long, readable hook over a calm screen and one payoff; ends where it can loop cleanly.",
    beats: [hook(5, "a calm, readable screen in use"), beat("payoff", 5, "the result"), close(2, "a calm screen close to the opening one, so the loop is seamless")],
  },
  {
    id: "quick-proof",
    name: "Result first",
    shape: "landscape",
    idea: "Hook, the result straight away, then how you get it.",
    beats: [hook(3.5), beat("payoff", 3.5, "the result"), beat("feature", 3, "how you get it"), close(2)],
  },
];

const DULL = /\b(empty|blank|home ?screen|loading|splash|log ?in|sign ?in|launch(es|ing)?|onboarding)\b/i;

/** A clip that makes a weak first shot: rated dull, or an empty, home, loading or login screen. */
export const weakOpener = (c: Pick<Clip, "notes">) => (c.notes?.interest ?? 3) <= 2 || DULL.test(c.notes?.label ?? "");

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

/** Templates that fit an output, minus `avoid` (used by sibling outputs) while at least one is left. */
export function templatesFor(spec: Pick<OutputSpec, "width" | "height">, avoid: string[] = []): CutTemplate[] {
  const shape = isLandscape(spec) ? "landscape" : "portrait";
  const all = TEMPLATES.filter((t) => t.shape === shape);
  const fresh = all.filter((t) => !avoid.includes(t.id));
  return fresh.length > 0 ? fresh : all;
}

/** What the model returns: the template it picked and one slot per beat. */
export const TemplateFill = z.object({
  template_id: z.string(),
  beats: z.array(
    z.object({
      /** clip_id or image_id of what plays in this beat. */
      source: z.string(),
      /** Seconds into the clip to start from (clips only). */
      offset: z.number().min(0).optional(),
      /** On-screen caption for beats that take one. */
      caption: z.string().optional(),
    }),
  ),
  /** Call to action for the end card of social ads. */
  cta: z.string().optional(),
  /** The App Store preview's closing line, under the app's name at the end: the reason to install, 2-5 words. */
  closing_line: z.string().optional(),
});
export type TemplateFill = z.infer<typeof TemplateFill>;

export interface FillContext {
  /** The opening line; null lets the first beat's caption be the hook. */
  hook: string | null;
  clips: Pick<Clip, "id" | "duration" | "notes">[];
  screenshots?: Pick<Screenshot, "id">[];
}

const round = (n: number) => Math.round(n * 100) / 100;
const BRAND_MIN = 2;
/** A still screenshot holds attention for a few seconds at most (top apps' previews cut every 3-4 s). */
const SCREENSHOT_MAX = 4;
/** A closing card that only shows the app's name and a line. */
const CLOSE_MAX = 3;
/** A recording beat in a portrait video cuts after this long (agency previews cut every 3-5 s on real actions). */
const CLIP_BEAT_MAX = 5;
/**
 * Apple shows the frame at 5 s as the preview's poster until it plays, so no cut lands within this many seconds of
 * it: the poster is always one settled shot with its whole caption, never a change-over.
 */
export const POSTER_SECOND = 5;
const POSTER_CLEAR = 0.5;

/** A caption that fits the on-screen limits: a few words, cut at a natural break, never over the character cap. */
export function tidyCaption(text: string): string {
  const words = shortLine(text, MAX_OVERLAY_WORDS).split(/\s+/).filter(Boolean);
  while (words.length > 1 && words.join(" ").length > MAX_OVERLAY_CHARS) words.pop();
  return dropDangling(words).join(" ").replace(/[,:;]$/, "");
}

/**
 * Build a timeline from a template and the model's fill. Returns errors (to send back to the model) instead of
 * a timeline when the fill names unknown media, has the wrong number of beats, or picks clips too short to
 * hold their beats.
 */
export function buildFromTemplate(
  template: CutTemplate,
  fill: TemplateFill,
  spec: OutputSpec,
  ctx: FillContext,
): { timeline: Timeline; errors: [] } | { timeline: null; errors: string[] } {
  const errors: string[] = [];
  if (fill.beats.length !== template.beats.length) {
    return { timeline: null, errors: [`Template "${template.id}" has ${template.beats.length} beats; you filled ${fill.beats.length}.`] };
  }
  const clips = new Map(ctx.clips.map((c) => [c.id, c]));
  const shots = new Set((ctx.screenshots ?? []).map((s) => s.id));
  const canScreenshot = spec.allowedSegments.includes("screenshot");

  const opening = hookLine(ctx.hook ?? fill.beats[0]?.caption ?? "");
  const captions = template.beats.map((b, i) => (b.caption ? tidyCaption(fill.beats[i]!.caption ?? "") : ""));
  template.beats.forEach((b, i) => {
    if (b.caption && !captions[i]) errors.push(`Beat ${i + 1} (${b.role}) needs a caption.`);
  });
  if (!opening) errors.push("Beat 1 needs a caption: it is the opening hook line.");
  // The first second sells the video: never open on an empty or loading screen when a better shot exists.
  const first = clips.get(fill.beats[0]?.source ?? "");
  if (first && weakOpener(first)) {
    const better = [...clips.values()].filter((c) => !weakOpener(c) && !isPrivate(c.notes)).sort((a, b) => (b.notes?.interest ?? 3) - (a.notes?.interest ?? 3))[0];
    if (better) errors.push(`Beat 1 opens on ${first.id} (${first.notes?.label ?? "a dull screen"}); open on a busier clip such as ${better.id} instead.`);
  }

  const total = Math.min(spec.maxSeconds, Math.max(spec.minSeconds, spec.targetSeconds));
  const weightSum = template.beats.reduce((n, b) => n + b.weight, 0);
  const useEndCard = template.endCard && spec.allowedSegments.includes("end_card") && !!fill.cta?.trim();
  const cta = useEndCard ? tidyCaption(fill.cta!) : "";
  // Portrait videos end on a reason to install under the app's name, not just the name.
  const closing = !useEndCard && !isLandscape(spec) && fill.closing_line?.trim() ? tidyCaption(fill.closing_line) : "";

  // Stills never hold past a few seconds, unless the video would come out under the spec's minimum.
  const stillBeats = template.beats.length - (useEndCard ? 1 : 0);
  const stillMax = Math.max(SCREENSHOT_MAX, (spec.minSeconds + 0.5 - (useEndCard ? CLOSE_MAX : 0)) / stillBeats);
  // Recording beats in portrait videos cut after a few seconds, unless the clips couldn't then fill the spec's minimum.
  const clipCapFits =
    !isLandscape(spec) &&
    template.beats.reduce((n, b, i) => {
      const clip = clips.get(fill.beats[i]!.source);
      const offset = clip ? Math.min(fill.beats[i]!.offset ?? 0, Math.max(0, clip.duration - 0.5)) : 0;
      return n + (b.role === "close" && useEndCard ? CLOSE_MAX : clip ? Math.min(CLIP_BEAT_MAX, clip.duration - offset) : stillMax);
    }, 0) >= spec.minSeconds + 0.5;
  // Length each beat can have, and the least it needs to read its text.
  const slots = template.beats.map((b, i) => {
    const f = fill.beats[i]!;
    const clip = clips.get(f.source);
    const offset = clip ? Math.min(f.offset ?? 0, Math.max(0, clip.duration - 0.5)) : 0;
    const available = clip ? clip.duration - offset : stillMax;
    const text = i === 0 ? opening : b.role === "close" ? cta || closing : captions[i]!;
    const least = Math.max(b.role === "close" ? BRAND_MIN : 1.2, text ? readSeconds(text) : 0);
    const isLastCard = b.role === "close" && useEndCard;
    if (!isLastCard && !clip && !shots.has(f.source)) errors.push(`Beat ${i + 1}: unknown clip or screenshot "${f.source}".`);
    if (!clip && shots.has(f.source) && !canScreenshot) errors.push(`Beat ${i + 1}: ${spec.label} can't use screenshots.`);
    // Landscape beats never hold past the pacing limits; if the clips run short the video is a little shorter.
    const cap = isLandscape(spec) ? (b.role === "close" ? MAX_OUTRO_SECONDS : MAX_BEAT_SECONDS) : isLastCard ? CLOSE_MAX : clip && clipCapFits ? CLIP_BEAT_MAX : Infinity;
    return { beat: b, source: f.source, clip, offset, available: Math.min(isLastCard ? Infinity : available, Math.max(cap, least)), want: (b.weight / weightSum) * total, least };
  });
  if (errors.length) return { timeline: null, errors };

  // Every beat gets at least the time to read its text; the extra comes out of the beats with time to spare.
  const deficit = slots.reduce((n, s) => n + Math.max(0, s.least - s.want), 0);
  const spare = slots.reduce((n, s) => n + Math.max(0, s.want - s.least), 0);
  for (const s of slots) {
    s.want = s.want < s.least ? s.least : s.want - (spare > 0 ? (deficit * (s.want - s.least)) / spare : 0);
  }

  // Give each beat its share, capped by what its clip holds; pass any shortfall on to later beats.
  let carry = 0;
  const lengths = slots.map((s) => {
    const len = Math.min(s.want + carry, s.available);
    carry = s.want + carry - len;
    return len;
  });
  // Whatever is left over goes back to earlier beats that still have footage.
  for (let i = lengths.length - 1; i >= 0 && carry > 0.01; i--) {
    const room = slots[i]!.available - lengths[i]!;
    const add = Math.min(room, carry);
    lengths[i] = lengths[i]! + add;
    carry -= add;
  }
  slots.forEach((s, i) => {
    if (lengths[i]! + 0.01 < s.least) {
      errors.push(
        s.clip
          ? `Beat ${i + 1}: ${s.source} has only ${round(s.available)}s from offset ${s.offset}; it needs ${round(s.least)}s. Pick a longer clip or an earlier offset.`
          : `Beat ${i + 1} is too short (${round(lengths[i]!)}s).`,
      );
    }
  });
  const sum = lengths.reduce((n, l) => n + l, 0);
  if (sum + 0.01 < spec.minSeconds) {
    errors.push(`The clips you picked only fill ${round(sum)}s; ${spec.label} needs at least ${spec.minSeconds}s. Use longer clips or add screenshots.`);
  }
  if (errors.length) return { timeline: null, errors };
  if (!isLandscape(spec) && !spec.loop) keepPosterClear(lengths, slots);

  const segments: Segment[] = [];
  const overlays: Segment[] = [];
  // Round the cut points, not the lengths, so rounding never pushes the total past the spec.
  const cuts = [0];
  for (const len of lengths) cuts.push(Math.min(spec.maxSeconds, round(cuts[cuts.length - 1]! + len)));
  slots.forEach((s, i) => {
    const start = cuts[i]!;
    const duration = round(cuts[i + 1]! - start);
    if (s.beat.role === "close" && useEndCard) {
      segments.push({ type: "end_card", start, duration, text: cta });
      return;
    }
    segments.push(
      s.clip
        ? { type: "screen", start, duration, clip_id: s.clip.id, clip_offset: round(s.offset) }
        : { type: "screenshot", start, duration, image_id: s.source },
    );
    if (i === 0) overlays.push({ type: "text", overlay: true, style: "hook", start, duration, text: opening });
    else if (s.beat.role === "close") overlays.push({ type: "text", overlay: true, style: "brand", start, duration, ...(closing ? { text: closing } : {}) });
    else if (captions[i]) overlays.push({ type: "text", overlay: true, style: "caption", start, duration, text: captions[i] });
  });
  return { timeline: { segments: [...segments, ...overlays], template: template.id }, errors: [] };
}

/**
 * Move a cut that lands within POSTER_CLEAR of the poster second to just outside it, taking the time from one
 * neighbouring beat and giving it to the other, as long as both still have the time and footage for it.
 */
export function keepPosterClear(lengths: number[], slots: { available: number; least: number }[]): void {
  let at = 0;
  for (let k = 1; k < lengths.length; k++) {
    at += lengths[k - 1]!;
    const off = at - POSTER_SECOND;
    if (Math.abs(off) >= POSTER_CLEAR) continue;
    const later = POSTER_CLEAR - off; // grow beat k-1 so the cut moves to 5.5 s
    const earlier = POSTER_CLEAR + off; // shrink beat k-1 so the cut moves to 4.5 s
    const canLater = lengths[k]! - later >= slots[k]!.least && lengths[k - 1]! + later <= slots[k - 1]!.available;
    const canEarlier = lengths[k - 1]! - earlier >= slots[k - 1]!.least && lengths[k]! + earlier <= slots[k]!.available;
    const move = canLater && (!canEarlier || later <= earlier) ? later : canEarlier ? -earlier : 0;
    lengths[k - 1] = lengths[k - 1]! + move;
    lengths[k] = lengths[k]! - move;
    return;
  }
}

export const TEMPLATE_SYSTEM = `You edit short app videos from proven templates. Pick ONE template from the list and fill
every beat in order with what plays in it.

For each beat give {"source": a clip_id or image_id, "offset": seconds into the clip to start (clips only),
"caption": on-screen text (only for beats with caption: true)}. Timing is worked out for you from the template.

Choosing media: beat 1 must show the app in action, never a clip marked weak_opener (an empty, home, loading or
login screen). Match each beat's note. Prefer high-interest clips, and use each clip at most once unless there are
too few. Start clips after any dead_time (frozen, loading or black stretches) by setting offset. Never use a clip
marked personal_info unless nothing else fits. Use screenshots only when the clips run out or are private.

Captions: 2 to ${CAPTION_WORDS} words, plain and punchy, in the brief's tone. Each one names what the viewer gets in that
beat, not what the screen shows ("Know every plant by name", not "Plant identification screen"). Feature beats are
benefits; a payoff beat is life after the app ("Your plants, thriving"). Never copy the listing, and never repeat the
words of the hook or of a screenshot's own headline.
If no hook is given, the first beat's caption is the opening hook line and must name the viewer's problem or the
result they want. For the App Store preview, add "closing_line": 2 to ${CAPTION_WORDS} words shown under the app's
name at the end, the reason to install, often echoing the hook ("Never lose a plant again"). For social ads with an
end card, add "cta": a short call to action (e.g. "Download free today").

Return JSON: {"template_id": "...", "beats": [...], "closing_line": "...", "cta": "..."}.`;

/** The prompt for one output: the spec, the fixed hook, the media and the templates to pick from. */
export function templatePrompt(
  spec: OutputSpec,
  ctx: FillContext & { brief: { features: string[]; tone: string } },
  templates: CutTemplate[],
  feedback: string,
): string {
  return JSON.stringify({
    output: { name: spec.label, target_seconds: spec.targetSeconds, loops: spec.loop || undefined, sound: spec.sound },
    hook: ctx.hook ?? undefined,
    brief: { features: ctx.brief.features, tone: ctx.brief.tone },
    clips: ctx.clips.map((c) => ({
      clip_id: c.id,
      seconds: c.duration,
      shows: c.notes?.label,
      feature: c.notes?.feature ?? undefined,
      interest: c.notes?.interest,
      personal_info: isPrivate(c.notes) || undefined,
      weak_opener: weakOpener(c) || undefined,
      dead_time: (c as Pick<Clip, "idle">).idle?.length ? (c as Pick<Clip, "idle">).idle : undefined,
    })),
    screenshots: ctx.screenshots?.length && spec.allowedSegments.includes("screenshot")
      ? ctx.screenshots.map((s) => {
          const notes = (s as Pick<Screenshot, "notes">).notes;
          return { image_id: s.id, shows: notes?.label, feature: notes?.feature ?? undefined, interest: notes?.interest };
        })
      : undefined,
    templates: templates.map((t) => ({
      id: t.id,
      idea: t.idea,
      beats: t.beats.map((b) => ({ role: b.role, show: b.note, caption: b.caption || undefined })),
      end_card: (t.endCard && spec.allowedSegments.includes("end_card")) || undefined,
    })),
    fix_these_errors_from_your_last_reply: feedback || undefined,
  });
}
