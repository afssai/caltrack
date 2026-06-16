# Security Notes

## Keys

The frontend uses only Supabase publishable configuration:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not put these in the frontend:

- Supabase service role key
- database password
- secret keys

## Local PIN

The PIN is a local privacy lock, not encryption.

The salted PIN hash is stored in browser localStorage under `caltrack.v2.security`. A person with full browser/device access may still inspect local app data.

## Local Data

PULSE stores local data in browser storage. This supports offline/private-first use, but local browser storage can be cleared by the user, browser, or device policy.

Users should export backups before major changes.

## Supabase Auth

Supabase magic-link authentication is separate from the local PIN.

Required Supabase dashboard settings:

- Email provider enabled.
- Site URL points to the canonical production app URL.
- Redirect allow-list includes all active URLs, such as GitHub Pages, Vercel production, and local preview when testing.

## Row Level Security

Every app table should have RLS enabled.

Policies should restrict rows to:

- `auth.uid() = user_id`
- `auth.uid() = id` for `profiles`

The `authenticated` role must also have table privileges. RLS policies alone are not enough if table grants are missing.

## Storage

The `progress-photos` bucket should be private.

Storage object paths should begin with the authenticated user ID:

```text
{user_id}/progress/{photo_id}.webp
```

Storage policies should restrict access to files under the user's own ID prefix.

## CSP

Production CSP must allow Supabase connections:

```text
connect-src https://mlztungodoqofuvykwpt.supabase.co wss://mlztungodoqofuvykwpt.supabase.co
```

Without this, Supabase Auth requests fail in the browser as generic network errors such as `Failed to fetch`.

## Current Risks

- Supabase redirect configuration cannot be proven from source code alone.
- End-to-end email login requires a real mailbox test.
- GitHub Pages cannot protect backend API keys or run server routes.
