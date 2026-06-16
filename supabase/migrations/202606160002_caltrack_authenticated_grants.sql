grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.diary_entries to authenticated;
grant select, insert, update, delete on table public.daily_logs to authenticated;
grant select, insert, update, delete on table public.measurements to authenticated;
grant select, insert, update, delete on table public.custom_foods to authenticated;
grant select, insert, update, delete on table public.pantry_items to authenticated;
grant select, insert, update, delete on table public.recipes to authenticated;
grant select, insert, update, delete on table public.recipe_items to authenticated;
grant select, insert, update, delete on table public.progress_photos to authenticated;
grant select, insert, update, delete on table public.sync_state to authenticated;
