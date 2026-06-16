# CalTrack V2

CalTrack V2 is a local-first calorie, nutrition, activity, weight, waist, pantry, recipe, and progress tracker built with React and Vite.

## Deployment reality

GitHub Pages is static. It cannot run secure backend API routes and cannot safely hold USDA or Gemini API keys.

Use Vercel as the primary deployment for the full app. GitHub Pages may remain as a static fallback only.

### GitHub Pages basic mode

Works without a backend:

- PIN lock for this browser
- Local diary, macros, fiber, water, activity, notes, weight, waist, and progress photos
- Custom foods, pantry ingredients, recipes, package calculator, and backup export/import
- Browser OCR with Tesseract.js
- Open Food Facts search and barcode lookup through public frontend-safe endpoints
- Supabase cloud sync can work on any host if `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and the Supabase migration are configured

Does not include:

- USDA FoodData Central search
- Gemini analysis
- Any server-protected API key feature

### Vercel full mode

Works with backend API routes:

- Everything in GitHub Pages basic mode
- `/api/usda` for USDA FoodData Central search
- `/api/gemini` for optional Gemini nutrition and meal/photo analysis

API keys are read only from Vercel environment variables:

- `USDA_API_KEY`
- `GEMINI_API_KEY` optional

No USDA or Gemini key is stored in frontend code or browser storage.

## Security model

The browser PIN is a practical privacy barrier, not encryption. Diary data, photos, goals, and the salted PIN hash remain in browser storage and can be accessed by someone with browser/developer access to the device. Use device encryption and a locked operating-system account for stronger protection.

The app does not claim to be hack proof.

## Local run

```bash
npm install
npm run build
npm run preview
```

For local full-mode API testing, set environment variables before starting the preview server:

```powershell
$env:USDA_API_KEY="your-usda-key"
$env:GEMINI_API_KEY="your-gemini-key"
npm run preview
```

The local preview server serves the built app at `http://localhost:4173`.

## Vercel setup

1. Import this repository into Vercel.
2. Set the framework preset to Vite.
3. Use build command `npm run build`.
4. Use output directory `dist`.
5. Add environment variable `VITE_SUPABASE_URL`.
6. Add environment variable `VITE_SUPABASE_PUBLISHABLE_KEY`.
7. Add environment variable `USDA_API_KEY`.
8. Optionally add `GEMINI_API_KEY`.
9. Deploy.

## Supabase setup

Run the SQL migration in `supabase/migrations/202606160001_caltrack_schema.sql` against the Supabase project:

- creates user-owned tables for profiles, diary entries, daily logs, measurements, custom foods, pantry, recipes, recipe items, progress photos, and sync state
- enables Row Level Security on every table
- adds user-only RLS policies
- creates the private `progress-photos` storage bucket
- adds storage policies so users can only access files under their own user ID path

The frontend uses only the Supabase publishable key:

```bash
VITE_SUPABASE_URL=https://mlztungodoqofuvykwpt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Do not put service-role or secret keys in the frontend.

Supabase Auth is optional and separate from the local PIN. CalTrack uses email magic links for cloud sync. Existing localStorage data is not deleted during migration.

Implemented in code:

- Supabase client in `src/lib/supabase.js`
- email magic-link auth UI in Settings
- manual "Migrate / sync now" flow
- localStorage fallback when Supabase is not configured or offline
- Supabase table upserts/pulls for diary, logs, measurements, custom foods, pantry, recipes, recipe items, progress photos, profile, and sync state
- WebP progress-photo optimization before local save/upload

Not implemented yet:

- Google Drive backup
- background sync through a service worker
- encrypted cloud storage
- automated conflict-resolution UI beyond preserving local data and merging by IDs

## Honest limitations

- OCR can be wrong, especially for curved, blurry, low-resolution, or poorly lit labels. It only provides suggestions.
- Gemini is optional. Without `GEMINI_API_KEY`, the app still works and Gemini requests return an unavailable message.
- Restaurant meal/photo analysis is estimate-only and must be manually reviewed.
- Open Food Facts availability and data quality depend on its public service.
- Progress photos are optimized to WebP before local save and Supabase upload, but local browser storage can still fill up. Export backups regularly.
