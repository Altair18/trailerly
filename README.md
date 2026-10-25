# Trailerly

Paste an App Store link, upload a screen recording, get one pack of rule-checked videos
(3 App Store videos + 5 social ads), paid per pack.

This is the skeleton: structure, schema, config and stubs. Pure logic (link parsing,
timeline spec enforcement, plain rules, scene splitting) is real and tested; anything that
calls an outside service is a stub marked `TODO(Mx)` with the milestone it belongs to.

## Stack

Next.js (TypeScript) · Supabase (Postgres, Auth, Storage) · Trigger.dev (jobs) ·
Remotion (render) · Gemini API / Veo 3.1 (video), fal fallback + upscaling ·
Claude Sonnet 5.5 (brief, hooks, timelines, frame checks) · ElevenLabs (voice) ·
Stripe Checkout · c2patool · Sentry

## Layout

```
src/
  app/                    Next.js pages and API routes
    packs/new             journey steps 1–2 (link, recording)
    packs/[packId]        journey steps 3–8
    api/packs             create pack, start prepare run; pack status
    api/stripe            checkout + webhook (starts final render)
  lib/
    env.ts                typed env; requireEnv() at point of use
    specs/outputs.ts      the 8 output specs (sizes, lengths, AI caps, file names)
    timeline/             segment schema + spec enforcement
    rules/                rules engine (plain checks + classifier stubs)
    schemas/              zod schemas for model JSON (brief, hooks, listing)
    llm/claude.ts         generateJson(): Claude -> schema-checked JSON
    video/                model router (Veo -> fal fallback), prompt hash, clip splitting
    cost/budget.ts        per-pack budget checks and spend logging
    ingest/appstore.ts    Apple lookup + reviews feed
    supabase/             admin, server and browser clients
  trigger/                the 10 pipeline stages + 3 pipeline runs
  remotion/               one composition per output, all reading timeline JSON
supabase/migrations/      the 8 tables with RLS
tests/                    vitest
```

## Pipeline runs

The flow pauses for the user twice, so it is three Trigger.dev runs:

1. `prepare-pack`: ingest listing → write brief → write hooks
2. `render-drafts`: plan timelines → AI scenes → voice → compose (draft) → rules
3. `render-final` (after Stripe payment): compose (final) → package

Stage 2 (`prepare-recording`) runs when the upload lands.

## Status

- **M1 (text only):** magic-link sign-in → paste a link → editable brief and 10 rule-checked hooks. Pick up to 5 social hooks and 1 headline.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in what you have; everything is optional at boot
npm run dev                  # web app
npm run trigger:dev          # background jobs (needs TRIGGER_SECRET_KEY)
npm run remotion:studio      # preview compositions
npm test && npm run typecheck
```

For M1 you need: a Supabase project (URL, anon key, service role key), `ANTHROPIC_API_KEY`,
and a Trigger.dev project (`TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY`). In Supabase Auth, add
`http://localhost:3000/auth/callback` to the redirect URLs. Run `npm run trigger:dev` alongside
`npm run dev`, and add the same env vars to the Trigger.dev project for deployed runs.

Database: create a Supabase project, then `supabase link` and `supabase db push`
to apply `supabase/migrations/0001_init.sql`. Replace `src/types/db.ts` with
`supabase gen types typescript` output once linked.
