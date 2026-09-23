create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table public.consent_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  title text not null,
  body text not null,
  is_active boolean not null default false,
  published_at timestamptz not null default now()
);

create unique index one_active_consent_version on public.consent_versions (is_active) where is_active = true;

create table public.consent_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_version_id uuid not null references public.consent_versions(id),
  accepted_at timestamptz not null default now(),
  locale text not null default 'ja',
  accepted_items jsonb not null default '{}'::jsonb,
  unique (user_id, consent_version_id)
);

create table public.onomatopoeia_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  consent_acceptance_id uuid not null references public.consent_acceptances(id),
  onomatopoeia text not null check (char_length(trim(onomatopoeia)) between 1 and 28),
  description text check (description is null or char_length(description) <= 500),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  photo_path text,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index on public.onomatopoeia_records (user_id, recorded_at desc);
create index on public.onomatopoeia_records (project_id, recorded_at desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.join_project_by_code(input_code text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  matched_project_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into matched_project_id from public.projects
  where is_active = true and code_hash = crypt(upper(trim(input_code)), code_hash)
  limit 1;
  if matched_project_id is null then raise exception 'Invalid project code'; end if;
  insert into public.project_memberships (project_id, user_id)
  values (matched_project_id, auth.uid())
  on conflict (project_id, user_id) do nothing;
  return matched_project_id;
end;
$$;

revoke all on function public.join_project_by_code(text) from public;
grant execute on function public.join_project_by_code(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_memberships enable row level security;
alter table public.consent_versions enable row level security;
alter table public.consent_acceptances enable row level security;
alter table public.onomatopoeia_records enable row level security;

create policy "Users can read their own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users can update their own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Members can read joined projects" on public.projects for select to authenticated using (exists (
  select 1 from public.project_memberships where project_memberships.project_id = projects.id and project_memberships.user_id = auth.uid()
));
create policy "Users can read their own memberships" on public.project_memberships for select to authenticated using (user_id = auth.uid());
create policy "Authenticated users can read active consent" on public.consent_versions for select to authenticated using (is_active = true);
create policy "Users can read their own consent history" on public.consent_acceptances for select to authenticated using (user_id = auth.uid());
create policy "Users can accept consent for themselves" on public.consent_acceptances for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.consent_versions where consent_versions.id = consent_version_id and consent_versions.is_active = true)
);
create policy "Users can read their own records" on public.onomatopoeia_records for select to authenticated using (user_id = auth.uid());
create policy "Users can create their own consented records" on public.onomatopoeia_records for insert to authenticated with check (
  user_id = auth.uid()
  and (project_id is null or exists (
    select 1 from public.project_memberships where project_memberships.project_id = onomatopoeia_records.project_id and project_memberships.user_id = auth.uid()
  ))
  and exists (
    select 1 from public.consent_acceptances where consent_acceptances.id = consent_acceptance_id and consent_acceptances.user_id = auth.uid()
  )
);
create policy "Users can delete their own records" on public.onomatopoeia_records for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('record-photos', 'record-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users can upload record photos into their folder" on storage.objects for insert to authenticated
with check (bucket_id = 'record-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can read their own record photos" on storage.objects for select to authenticated
using (bucket_id = 'record-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete their own record photos" on storage.objects for delete to authenticated
using (bucket_id = 'record-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 管理者はSupabase SQL Editorから次の形式でプロジェクトを追加する。
-- insert into public.projects (name, code_hash)
-- values ('2026 焼津まち歩き', crypt(upper('HUMAI-YAIZU-2026'), gen_salt('bf')));

-- 正式な同意文が確定した後、次の形式で有効な版を追加する。
-- insert into public.consent_versions (version, title, body, is_active)
-- values ('1.0', '利用への同意', 'ここに正式な同意文を入力', true);
