# CalTrack Architecture

## Application

CalTrack is a React + Vite single-page app. The entry point is `src/main.jsx`, which renders `src/AppV2.jsx`.

The app keeps local-first state in browser `localStorage`:

- `caltrack.v2`: diary, profile, logs, measurements, custom foods, pantry, recipes, photos
- `caltrack.v2.security`: salted local PIN hash
- `caltrack.v2.supabase.sync`: sync metadata
- `caltrack.v2.onboarding`: onboarding state

## Supabase Client

`src/lib/supabase.js` creates the Supabase browser client using:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

No service-role key, database password, or secret key is used in frontend code. Supabase must be configured through Vite environment variables at build time.

## Supabase Auth Flow

`src/supabaseSync.js` uses `supabase.auth.signInWithOtp()` for email magic links.

Redirect behavior:

- `emailRedirectTo` is set to the current app URL without hash fragments.
- Supabase JS handles URL session detection with `detectSessionInUrl: true`.
- Sessions persist through Supabase JS local browser storage.

The local PIN is separate from Supabase Auth. PIN unlocks this browser; Supabase Auth identifies the cloud user.

## Cloud Sync

Cloud sync is optional. Local data remains the source of truth during normal use.

Sync flow:

1. User signs in with Supabase magic link.
2. User clicks `Migrate / sync now`.
3. Local data is mapped into Supabase tables.
4. Existing local data is not deleted.
5. Remote rows are pulled back and merged by local IDs.
6. Sync metadata records synced IDs and timestamps.

Progress photos are converted to WebP and resized before local save/upload.

## Database

Migrations live in `supabase/migrations`.

Current migrations:

- `202606160001_caltrack_schema.sql`: tables, RLS policies, storage bucket/policies
- `202606160002_caltrack_authenticated_grants.sql`: explicit table grants for the `authenticated` role

## Deployment

GitHub Pages uses `.github/workflows/deploy.yml`.

Vercel uses:

- `vercel.json`
- serverless API routes in `api/`

## Content Security Policy

CSP is configured in both:

- `vercel.json`
- `server.mjs`

Supabase is allow-listed in `connect-src`:

- `https://mlztungodoqofuvykwpt.supabase.co`
- `wss://mlztungodoqofuvykwpt.supabase.co`

This is required for Supabase Auth, PostgREST, Storage, and realtime-compatible connections.

## Static vs Server API Features

GitHub Pages can run:

- React app
- localStorage features
- Supabase frontend auth/sync
- Open Food Facts public calls
- browser OCR

GitHub Pages cannot run:

- `/api/usda`
- `/api/gemini`

Those API routes require Vercel or another backend host.
