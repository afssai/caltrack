create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  calorie_target numeric,
  protein_target numeric,
  carbs_target numeric,
  fat_target numeric,
  fiber_target numeric,
  water_target numeric,
  goal_weight numeric,
  session_timeout integer,
  onboarding_dismissed boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  entry_date date not null,
  meal text not null,
  name text not null,
  brand text,
  source text,
  source_id text,
  ingredients text,
  confidence text,
  grams numeric,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  fiber numeric,
  per100 jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_id)
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  log_date date not null,
  water_ml numeric default 0,
  notes text,
  activities jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_id),
  unique (user_id, log_date)
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  measured_date date not null,
  weight numeric,
  waist numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_id)
);

create table if not exists public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  name text not null,
  brand text,
  source text,
  source_id text,
  confidence text,
  serving_grams numeric,
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,
  ingredients text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_id)
);

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  name text not null,
  brand text,
  source text,
  source_id text,
  confidence text,
  default_grams numeric,
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_id)
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  title text not null,
  type text,
  steps text,
  reason text,
  confidence text,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  fiber numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_id)
);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade,
  recipe_local_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  pantry_item_id uuid references public.pantry_items(id) on delete set null,
  pantry_local_id text,
  name text not null,
  grams numeric,
  confidence text,
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_id)
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  photo_date date not null,
  view text not null,
  storage_path text,
  thumbnail_path text,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_id)
);

create table if not exists public.sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device_id text,
  last_pull_at timestamptz,
  last_push_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'diary_entries',
    'daily_logs',
    'measurements',
    'custom_foods',
    'pantry_items',
    'recipes',
    'recipe_items',
    'progress_photos',
    'sync_state'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.diary_entries enable row level security;
alter table public.daily_logs enable row level security;
alter table public.measurements enable row level security;
alter table public.custom_foods enable row level security;
alter table public.pantry_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.progress_photos enable row level security;
alter table public.sync_state enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

create policy "diary_entries_select_own" on public.diary_entries for select using (auth.uid() = user_id);
create policy "diary_entries_insert_own" on public.diary_entries for insert with check (auth.uid() = user_id);
create policy "diary_entries_update_own" on public.diary_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "diary_entries_delete_own" on public.diary_entries for delete using (auth.uid() = user_id);

create policy "daily_logs_select_own" on public.daily_logs for select using (auth.uid() = user_id);
create policy "daily_logs_insert_own" on public.daily_logs for insert with check (auth.uid() = user_id);
create policy "daily_logs_update_own" on public.daily_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_logs_delete_own" on public.daily_logs for delete using (auth.uid() = user_id);

create policy "measurements_select_own" on public.measurements for select using (auth.uid() = user_id);
create policy "measurements_insert_own" on public.measurements for insert with check (auth.uid() = user_id);
create policy "measurements_update_own" on public.measurements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "measurements_delete_own" on public.measurements for delete using (auth.uid() = user_id);

create policy "custom_foods_select_own" on public.custom_foods for select using (auth.uid() = user_id);
create policy "custom_foods_insert_own" on public.custom_foods for insert with check (auth.uid() = user_id);
create policy "custom_foods_update_own" on public.custom_foods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "custom_foods_delete_own" on public.custom_foods for delete using (auth.uid() = user_id);

create policy "pantry_items_select_own" on public.pantry_items for select using (auth.uid() = user_id);
create policy "pantry_items_insert_own" on public.pantry_items for insert with check (auth.uid() = user_id);
create policy "pantry_items_update_own" on public.pantry_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pantry_items_delete_own" on public.pantry_items for delete using (auth.uid() = user_id);

create policy "recipes_select_own" on public.recipes for select using (auth.uid() = user_id);
create policy "recipes_insert_own" on public.recipes for insert with check (auth.uid() = user_id);
create policy "recipes_update_own" on public.recipes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recipes_delete_own" on public.recipes for delete using (auth.uid() = user_id);

create policy "recipe_items_select_own" on public.recipe_items for select using (auth.uid() = user_id);
create policy "recipe_items_insert_own" on public.recipe_items for insert with check (auth.uid() = user_id);
create policy "recipe_items_update_own" on public.recipe_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recipe_items_delete_own" on public.recipe_items for delete using (auth.uid() = user_id);

create policy "progress_photos_select_own" on public.progress_photos for select using (auth.uid() = user_id);
create policy "progress_photos_insert_own" on public.progress_photos for insert with check (auth.uid() = user_id);
create policy "progress_photos_update_own" on public.progress_photos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "progress_photos_delete_own" on public.progress_photos for delete using (auth.uid() = user_id);

create policy "sync_state_select_own" on public.sync_state for select using (auth.uid() = user_id);
create policy "sync_state_insert_own" on public.sync_state for insert with check (auth.uid() = user_id);
create policy "sync_state_update_own" on public.sync_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sync_state_delete_own" on public.sync_state for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "progress_photos_storage_select_own"
on storage.objects for select
using (bucket_id = 'progress-photos' and auth.uid()::text = split_part(name, '/', 1));

create policy "progress_photos_storage_insert_own"
on storage.objects for insert
with check (bucket_id = 'progress-photos' and auth.uid()::text = split_part(name, '/', 1));

create policy "progress_photos_storage_update_own"
on storage.objects for update
using (bucket_id = 'progress-photos' and auth.uid()::text = split_part(name, '/', 1))
with check (bucket_id = 'progress-photos' and auth.uid()::text = split_part(name, '/', 1));

create policy "progress_photos_storage_delete_own"
on storage.objects for delete
using (bucket_id = 'progress-photos' and auth.uid()::text = split_part(name, '/', 1));
