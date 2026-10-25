/**
 * Plan the same fixed apps with both planner setups and compare: how often each plan holds up, which
 * templates come out, and the tokens each model used. Calls the real Claude API (a few cents a run).
 *
 *   npm run compare:planners
 *
 * Needs ANTHROPIC_API_KEY (read from .env.local if present). Writes the timelines to scripts/out/ for a look.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { generateJson, onLlmUsage, type LlmUsage, type Tier } from "@/lib/llm/claude";
import { OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { planTimeline, type PlanContext } from "@/lib/timeline/plan";
import { TEMPLATE_SYSTEM, TemplateFill } from "@/lib/timeline/templates";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No file: use the shell's environment.
}

const notes = (label: string, interest: number, feature: string | null = null) => ({ label, interest, feature, personal_info: false });

const APPS: { name: string; ctx: Omit<PlanContext, "avoidTemplates"> }[] = [
  {
    name: "Plant care",
    ctx: {
      brief: { what_it_does: "Reminds you when to water and diagnoses sick plants from a photo", audience: "Busy plant owners", features: ["Smart watering reminders", "Photo diagnosis", "Plant journal"], review_phrases: [], tone: "Warm, light" },
      headline: "Stop guessing when to water",
      clips: [
        { id: "clip_1", duration: 5.5, notes: notes("Opens the app to a list of plants", 3, "Plant journal"), idle: [{ start: 0, duration: 1.4 }] },
        { id: "clip_2", duration: 8, notes: notes("Takes a photo of a yellow leaf and gets a diagnosis", 5, "Photo diagnosis") },
        { id: "clip_3", duration: 6.2, notes: notes("Sets a watering schedule", 4, "Smart watering reminders") },
        { id: "clip_4", duration: 4.8, notes: notes("Scrolls the plant journal", 2, "Plant journal") },
      ],
    },
  },
  {
    name: "Budgeting",
    ctx: {
      brief: { what_it_does: "Sorts your spending automatically and warns before you overspend", audience: "Young professionals", features: ["Auto-categorised spending", "Overspend alerts", "Savings goals"], review_phrases: [], tone: "Confident, plain" },
      headline: "See where your money goes",
      clips: [
        { id: "clip_1", duration: 7, notes: notes("Dashboard with spending by category", 5, "Auto-categorised spending") },
        { id: "clip_2", duration: 5, notes: notes("An overspend alert pops up", 4, "Overspend alerts") },
        { id: "clip_3", duration: 9, notes: notes("Creates a savings goal for a trip", 4, "Savings goals"), idle: [{ start: 6, duration: 3 }] },
      ],
    },
  },
  {
    name: "Language app (screenshots only)",
    ctx: {
      brief: { what_it_does: "Short daily lessons with speech practice", audience: "Beginners", features: ["5-minute lessons", "Speech feedback", "Streaks"], review_phrases: [], tone: "Playful" },
      headline: "Speak Spanish in 5 minutes a day",
      clips: [],
      screenshots: [
        { id: "shot_1", notes: notes("Lesson picker", 4, "5-minute lessons") },
        { id: "shot_2", notes: notes("Speaking exercise with a score", 5, "Speech feedback") },
        { id: "shot_3", notes: notes("Streak calendar", 3, "Streaks") },
        { id: "shot_4", notes: notes("Lesson complete screen", 3, null) },
      ],
    },
  },
];

const SPECS: OutputSpecId[] = ["preview", "header", "search"];
const SETUPS: { name: string; tierFor: (tier: Tier) => Tier }[] = [
  { name: "fast first, main model retry", tierFor: (t) => t },
  { name: "main model only", tierFor: () => "smart" },
];

it("compares planner setups", async () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY (or add it to .env.local) to run the comparison.");
  const rows: Record<string, unknown>[] = [];
  const tokens: Record<string, Record<string, { calls: number; input: number; output: number }>> = {};
  const out: Record<string, unknown> = {};

  for (const setup of SETUPS) {
    tokens[setup.name] = {};
    onLlmUsage((u: LlmUsage) => {
      const t = (tokens[setup.name]![u.model] ??= { calls: 0, input: 0, output: 0 });
      t.calls += 1;
      t.input += u.input_tokens;
      t.output += u.output_tokens;
    });
    for (const app of APPS) {
      const used: string[] = [];
      for (const id of SPECS) {
        const started = Date.now();
        const result = await planTimeline(OUTPUT_SPECS[id], { ...app.ctx, avoidTemplates: used }, (prompt, tier) =>
          generateJson({ schema: TemplateFill, system: TEMPLATE_SYSTEM, prompt, tier: setup.tierFor(tier), maxTokens: 2048, step: `compare:${id}` }),
        );
        if (result.timeline.template) used.push(result.timeline.template);
        rows.push({
          setup: setup.name,
          app: app.name,
          output: id,
          planned_by: result.source,
          template: result.timeline.template ?? "-",
          attempts: result.attempts,
          seconds: Math.round((Date.now() - started) / 100) / 10,
        });
        out[`${setup.name} / ${app.name} / ${id}`] = { ...result.timeline, errors: result.errors };
      }
    }
  }
  onLlmUsage(undefined);

  console.table(rows);
  for (const [setup, models] of Object.entries(tokens)) {
    console.log(`\n${setup}`);
    console.table(models);
  }
  const fallbacks = (setup: string) => rows.filter((r) => r.setup === setup && r.planned_by === "fallback").length;
  for (const s of SETUPS) console.log(`${s.name}: ${fallbacks(s.name)} of ${APPS.length * SPECS.length} plans fell back to the code-built cut.`);

  mkdirSync("scripts/out", { recursive: true });
  const file = `scripts/out/compare-planners-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify({ rows, tokens, timelines: out }, null, 2));
  console.log(`\nTimelines written to ${file}`);
});
