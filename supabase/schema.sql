-- Higuera Tree Care · zellin.ai
-- Paste into the Supabase SQL editor for project `tree_mapping`.

create table if not exists tree_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tree_projects_user_id_idx
  on tree_projects(user_id, created_at desc);

create table if not exists tree_pins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references tree_projects(id) on delete cascade,
  pin_number int not null,
  latitude double precision not null,
  longitude double precision not null,
  species_name text not null,
  quantity int not null default 1,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists tree_pins_project_id_idx
  on tree_pins(project_id, pin_number);

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
