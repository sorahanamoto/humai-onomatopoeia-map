alter table public.onomatopoeia_records
  add constraint onomatopoeia_records_description_required
  check (description is not null and btrim(description) <> '') not valid;

comment on constraint onomatopoeia_records_description_required on public.onomatopoeia_records
  is 'Requires a non-empty description for newly created onomatopoeia records.';
