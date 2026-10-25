-- Guided recording: the shot list Claude writes from the brief, shown before the user records.
alter table packs add column shot_list_json jsonb;
