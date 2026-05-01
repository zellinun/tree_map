-- Higuera Tree Care · zellin.ai
-- Paste into the Supabase SQL editor for project `tree_mapping`.

create table if not exists tree_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  description text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tree_projects_user_id_idx
  on tree_projects(user_id, created_at desc);

-- Idempotent column adds for repos that ran an earlier version of this schema.
alter table tree_projects
  add column if not exists latitude double precision;

alter table tree_projects
  add column if not exists longitude double precision;

create table if not exists tree_pins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references tree_projects(id) on delete cascade,
  pin_number int not null,
  latitude double precision not null,
  longitude double precision not null,
  species_name text not null,
  quantity int not null default 1,
  description text,
  color text not null default '#15803D',
  photos text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists tree_pins_project_id_idx
  on tree_pins(project_id, pin_number);

-- Idempotent column add for repos that ran an earlier version of this schema.
alter table tree_pins
  add column if not exists color text not null default '#15803D';

alter table tree_pins
  add column if not exists photos text[] not null default '{}';

alter table tree_projects enable row level security;
alter table tree_pins enable row level security;

drop policy if exists "own projects" on tree_projects;
create policy "own projects" on tree_projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own pins" on tree_pins;
create policy "own pins" on tree_pins
  for all using (
    project_id in (select id from tree_projects where user_id = auth.uid())
  ) with check (
    project_id in (select id from tree_projects where user_id = auth.uid())
  );

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists tree_projects_updated_at on tree_projects;
create trigger tree_projects_updated_at
before update on tree_projects
for each row execute function set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- Storage bucket for pin photos. PinSheet uploads to this bucket via
-- supabase.storage.from("tree_photos").upload(...) then stores the resulting
-- public URL on tree_pins.photos.
--
-- IF the SQL bucket-create silently fails on your Supabase plan (it can,
-- depending on tier and project age), use the dashboard instead:
--   Supabase project → Storage → New bucket
--     name:   tree_photos
--     public: ON
--     save
-- Then run the four policies below — those still go through SQL on every
-- plan. The inserts/policies are idempotent so re-running is safe.

insert into storage.buckets (id, name, public)
values ('tree_photos', 'tree_photos', true)
on conflict (id) do nothing;

drop policy if exists "tree_photos public read" on storage.objects;
create policy "tree_photos public read"
  on storage.objects for select
  using (bucket_id = 'tree_photos');

drop policy if exists "tree_photos auth upload" on storage.objects;
create policy "tree_photos auth upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'tree_photos');

drop policy if exists "tree_photos auth update" on storage.objects;
create policy "tree_photos auth update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'tree_photos')
  with check (bucket_id = 'tree_photos');

drop policy if exists "tree_photos auth delete" on storage.objects;
create policy "tree_photos auth delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'tree_photos');

-- ──────────────────────────────────────────────────────────────────────────
-- Tell PostgREST to refresh its schema cache so newly-added columns
-- (e.g. tree_projects.latitude / .longitude) are immediately visible to
-- the JS client. Without this, supabase-js can fail with
-- "Could not find the 'latitude' column of 'tree_projects' in the schema cache"
-- for up to a minute after the migration.
notify pgrst, 'reload schema';

-- ──────────────────────────────────────────────────────────────────────────
-- Note on existing pin colors: the app renders pins with the
-- brighter HSL scheme (hue 95% 50%) even for rows that were stored
-- under the older 70%/45% scheme — see the `displayColor` helper in
-- src/lib/species.ts which is invoked at render time. No SQL recolor
-- migration is needed.
