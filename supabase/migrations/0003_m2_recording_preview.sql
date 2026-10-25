-- M2: recording upload and processing state, per-output render state, private storage bucket.

insert into storage.buckets (id, name, public)
values ('trailerly', 'trailerly', false)
on conflict (id) do nothing;

create type source_status as enum ('uploading', 'preparing', 'ready', 'error');
alter table sources
  add column status source_status not null default 'uploading',
  add column error text,
  add column file_name text,
  add column created_at timestamptz not null default now();

create type output_status as enum ('queued', 'planning', 'rendering', 'ready', 'failed');
alter table outputs
  add column status output_status not null default 'queued',
  add column error text,
  add column updated_at timestamptz not null default now();
