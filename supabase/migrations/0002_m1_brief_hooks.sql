-- M1: track pipeline progress on the pack and keep the proposed hooks.

create type pack_stage as enum ('ingesting', 'writing_brief', 'writing_hooks', 'review', 'error');

alter table packs
  add column stage pack_stage not null default 'ingesting',
  add column stage_error text,
  add column hooks_json jsonb;

-- Writes go through API routes (service role) after an ownership check, so users
-- can't change cost or status columns directly with the anon key.
drop policy "own apps" on apps;
create policy "own apps" on apps for select using (user_id = auth.uid());

drop policy "own packs" on packs;
create policy "own packs" on packs for select
  using (exists (select 1 from apps a where a.id = packs.app_id and a.user_id = auth.uid()));

drop policy "own sources" on sources;
create policy "own sources" on sources for select
  using (exists (select 1 from packs p join apps a on a.id = p.app_id where p.id = sources.pack_id and a.user_id = auth.uid()));
