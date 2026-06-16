# PULSE

Personal calorie, nutrition, and fitness tracker — built for one user.

## Running locally (home WiFi only)

```powershell
node server.mjs
```

App available at `http://localhost:4173` or `http://192.168.100.43:4173` on your phone.

## Running from anywhere (Vercel)

Push to `main` branch → Vercel auto-deploys to `https://caltrack-orpin.vercel.app`

Required Vercel environment variables:

```
GEMINI_API_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Optional:
```
USDA_API_KEY
```

## Data

All data is stored in browser localStorage. Supabase cloud sync is available after signing in with email magic link (Settings → Cloud Backup).
