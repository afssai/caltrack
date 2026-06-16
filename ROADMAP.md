# Roadmap

## Phase 1: Stabilize Infrastructure

- Confirm Supabase Auth magic-link flow on the production URL.
- Confirm Supabase redirect URLs include every active production and preview URL.
- Apply all Supabase migrations.
- Verify authenticated user can insert/select/update/delete each sync table.
- Verify progress photo upload to the private bucket.
- Decide whether GitHub Pages or Vercel is the canonical production URL.

## Phase 2: Data Safety

- Move large local data from `localStorage` to IndexedDB.
- Add explicit sync conflict handling.
- Add a recovery screen for failed imports/syncs.
- Add a migration status screen that lists synced and pending local records.

## Phase 3: Reliability

- Add automated smoke tests for PIN, local diary, backup export/import, Supabase Auth, and sync.
- Add deployment checks that fail if required CSP hosts are missing.
- Add Supabase schema verification scripts.

## Phase 4: Product Work

- Resume feature work only after infrastructure and sync are proven stable.
- Keep V1 personal/private-first.
- Do not add new AI workflows until backend deployment and data safety are settled.
