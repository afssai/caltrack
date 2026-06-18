-- Add extended profile columns missing from initial schema
alter table public.profiles
  add column if not exists name text default '',
  add column if not exists gender text default '',
  add column if not exists age numeric,
  add column if not exists height numeric,
  add column if not exists weight numeric,
  add column if not exists activity_level text default 'light',
  add column if not exists highest_weight numeric,
  add column if not exists medical_conditions text default '',
  add column if not exists medications text default '',
  add column if not exists goal_mode text default 'lose',
  add column if not exists deficit_rate numeric default 500;

-- Add neck measurement for Navy body-fat formula
alter table public.measurements
  add column if not exists neck numeric;

-- Add health tracking columns to daily_logs
alter table public.daily_logs
  add column if not exists health_flags jsonb default '[]'::jsonb,
  add column if not exists meds_taken jsonb default '[]'::jsonb,
  add column if not exists coffees integer default 0;
