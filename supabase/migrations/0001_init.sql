-- Trailerly initial schema: eight tables. A pack belongs to an app; everything else hangs off the pack.

create type pack_status as enum ('draft', 'paid', 'rendering', 'ready', 'failed');
create type source_kind as enum ('recording', 'screenshot');
create type output_spec as enum ('preview', 'header', 'search', 'social_1', 'social_2', 'social_3', 'social_4', 'social_5');
create type rule_result as enum ('pass', 'warn', 'block');

-- Mirrors auth.users so app tables can reference a public row.
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  store text not null default 'apple' check (store in ('apple')),
  store_id text not null,
  country text not null,
  name text not null,
  icon_url text,
  listing_json jsonb not null,
  fetched_at timestamptz not null default now(),
  unique (user_id, store, store_id, country)
);

create table packs (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps (id) on delete cascade,
  status pack_status not null default 'draft',
  brief_json jsonb,
  chosen_hooks jsonb,
  price_pence integer not null,
  cost_budget_pence integer not null,
  cost_spent_pence integer not null default 0,
  created_at timestamptz not null default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references packs (id) on delete cascade,
  kind source_kind not null,
  url text not null,
  duration_s numeric,
  clips_json jsonb
);

create table outputs (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references packs (id) on delete cascade,
  spec output_spec not null,
  timeline_json jsonb,
  draft_url text,
  final_url text,
  rules_status rule_result,
  unique (pack_id, spec)
);

create table scenes (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references outputs (id) on delete cascade,
  prompt text not null,
  prompt_hash text not null,
  model text,
  seconds numeric not null,
  tries integer not null default 0,
  cost_pence integer not null default 0,
  clip_url text,
  qa_status rule_result
);
create index scenes_prompt_hash_idx on scenes (prompt_hash);

create table rule_results (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references outputs (id) on delete cascade,
  rule text not null,
  result rule_result not null,
  detail text,
  overridden_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references packs (id) on delete cascade,
  stripe_session_id text not null unique,
  amount_pence integer not null,
  status text not null,
  created_at timestamptz not null default now()
);

-- Row level security: users see only their own rows. Jobs use the service role and bypass RLS.
alter table users enable row level security;
alter table apps enable row level security;
alter table packs enable row level security;
alter table sources enable row level security;
alter table outputs enable row level security;
alter table scenes enable row level security;
alter table rule_results enable row level security;
alter table payments enable row level security;

create policy "own user row" on users for select using (id = auth.uid());
create policy "own apps" on apps for all using (user_id = auth.uid());
create policy "own packs" on packs for all
  using (exists (select 1 from apps a where a.id = packs.app_id and a.user_id = auth.uid()));
create policy "own sources" on sources for all
  using (exists (select 1 from packs p join apps a on a.id = p.app_id where p.id = sources.pack_id and a.user_id = auth.uid()));
create policy "own outputs" on outputs for select
  using (exists (select 1 from packs p join apps a on a.id = p.app_id where p.id = outputs.pack_id and a.user_id = auth.uid()));
create policy "own scenes" on scenes for select
  using (exists (select 1 from outputs o join packs p on p.id = o.pack_id join apps a on a.id = p.app_id where o.id = scenes.output_id and a.user_id = auth.uid()));
create policy "own rule results" on rule_results for select
  using (exists (select 1 from outputs o join packs p on p.id = o.pack_id join apps a on a.id = p.app_id where o.id = rule_results.output_id and a.user_id = auth.uid()));
create policy "own payments" on payments for select
  using (exists (select 1 from packs p join apps a on a.id = p.app_id where p.id = payments.pack_id and a.user_id = auth.uid()));

-- Create the public user row on sign-up.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
