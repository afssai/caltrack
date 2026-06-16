create table if not exists public.food_cache (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null,
  name text not null,
  brand text,
  search_text text not null,
  confidence text,
  serving_grams numeric,
  ingredients text,
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,
  is_starter boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists food_cache_search_text_idx on public.food_cache using gin (to_tsvector('simple', search_text));

drop trigger if exists set_food_cache_updated_at on public.food_cache;
create trigger set_food_cache_updated_at
before update on public.food_cache
for each row execute function public.set_updated_at();

alter table public.food_cache enable row level security;

drop policy if exists "food_cache_select_all" on public.food_cache;
create policy "food_cache_select_all"
on public.food_cache for select
using (true);

drop policy if exists "food_cache_insert_authenticated" on public.food_cache;
create policy "food_cache_insert_authenticated"
on public.food_cache for insert
with check (auth.uid() = created_by);

grant select on table public.food_cache to anon, authenticated;
grant insert on table public.food_cache to authenticated;

insert into public.food_cache (
  source,
  source_id,
  name,
  brand,
  search_text,
  confidence,
  serving_grams,
  ingredients,
  calories_per_100g,
  protein_per_100g,
  carbs_per_100g,
  fat_per_100g,
  fiber_per_100g,
  is_starter
) values
  ('Starter food', 'starter:banana', 'Banana', 'Common food', 'banana fruit common food', 'manual', 118, 'Banana', 89, 1.1, 22.8, 0.3, 2.6, true),
  ('Starter food', 'starter:apple', 'Apple', 'Common food', 'apple fruit common food', 'manual', 182, 'Apple', 52, 0.3, 13.8, 0.2, 2.4, true),
  ('Starter food', 'starter:egg', 'Egg', 'Common food', 'egg eggs common food', 'manual', 50, 'Egg', 143, 12.6, 0.7, 9.5, 0, true),
  ('Starter food', 'starter:rice-cooked', 'Rice, cooked', 'Common food', 'rice cooked white rice common food', 'manual', 150, 'Cooked white rice', 130, 2.7, 28.2, 0.3, 0.4, true),
  ('Starter food', 'starter:chicken-breast', 'Chicken breast, cooked', 'Common food', 'chicken breast cooked common food', 'manual', 100, 'Cooked skinless chicken breast', 165, 31, 0, 3.6, 0, true),
  ('Starter food', 'starter:yogurt', 'Plain yogurt', 'Common food', 'yogurt plain common food', 'manual', 170, 'Plain yogurt', 61, 3.5, 4.7, 3.3, 0, true),
  ('Starter food', 'starter:milk', 'Milk', 'Common food', 'milk common food', 'manual', 244, 'Milk', 61, 3.2, 4.8, 3.3, 0, true),
  ('Starter food', 'starter:oats', 'Oats', 'Common food', 'oats oatmeal rolled oats common food', 'manual', 40, 'Rolled oats', 389, 16.9, 66.3, 6.9, 10.6, true),
  ('Starter food', 'starter:nasi-lemak', 'Nasi lemak', 'Starter estimate', 'nasi lemak coconut rice sambal malaysia singapore', 'manual', 350, 'Coconut rice, sambal, egg, peanuts, anchovies, cucumber', 189, 6, 24, 8, 1.5, true),
  ('Starter food', 'starter:roti-canai', 'Roti canai', 'Starter estimate', 'roti canai prata flatbread malaysia singapore', 'manual', 95, 'Flatbread made with flour, fat, and water', 320, 7, 46, 12, 2, true)
on conflict (source, source_id) do update
set name = excluded.name,
    brand = excluded.brand,
    search_text = excluded.search_text,
    confidence = excluded.confidence,
    serving_grams = excluded.serving_grams,
    ingredients = excluded.ingredients,
    calories_per_100g = excluded.calories_per_100g,
    protein_per_100g = excluded.protein_per_100g,
    carbs_per_100g = excluded.carbs_per_100g,
    fat_per_100g = excluded.fat_per_100g,
    fiber_per_100g = excluded.fiber_per_100g,
    is_starter = excluded.is_starter;
