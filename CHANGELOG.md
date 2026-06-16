# Changelog

## Unreleased

### Infrastructure

- Added Supabase browser client through `@supabase/supabase-js`.
- Added Supabase auth and local-first sync module.
- Added Supabase schema migration for app tables, RLS policies, and progress photo storage.
- Added follow-up migration granting table access to the authenticated role.
- Added GitHub Pages build-time Supabase environment variables.
- Updated CSP for Vercel and local preview to allow Supabase HTTPS/WSS connections.
- Added friendlier Supabase network/CSP error messages.
- Added cloud sync health status in Settings.

### Documentation

- Added project brief.
- Added architecture document.
- Added roadmap.
- Added security notes.

### Known Issues

- End-to-end magic-link login requires testing with a real inbox and Supabase redirect URL configuration.
- Supabase migrations must be applied to the hosted project before cloud data sync can fully work.
- GitHub Pages cannot host USDA/Gemini backend routes.
