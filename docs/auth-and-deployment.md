# Profiles, Google sign-in, and free deployment

NOCTURNE runs without an account. Guests keep their paper ledger in the current browser. Connecting a free Supabase project adds Google sign-in, passwordless email, private cross-device paper data, and synced preferences.

## 1. Create the profile database

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Open **SQL Editor** and run [`supabase/migrations/202607200001_profiles_and_paper_accounts.sql`](../supabase/migrations/202607200001_profiles_and_paper_accounts.sql) once.
3. In **Project Settings → API**, copy the project URL and publishable key. A legacy anon key also works locally, but never use a service-role key in the browser.

The migration keeps emails in `auth.users`, enables row-level security on every public table, indexes user-scoped queries, enforces paper-risk limits inside database functions, and provides self-service account deletion.

## 2. Configure URLs and email

In **Authentication → URL Configuration** set:

- Site URL: `https://daniel-techai.github.io/CryptoFuck/`
- Redirect URL: `https://daniel-techai.github.io/CryptoFuck/**`
- Local redirect: `http://127.0.0.1:5173/**`

Magic links work with Supabase's trial mailer for limited testing. Before inviting the public, configure custom SMTP in **Authentication → SMTP Settings**; the trial sender is intentionally rate-limited and is not a production mail service.

## 3. Link Google / Gmail profiles

Follow [Supabase's Google login guide](https://supabase.com/docs/guides/auth/social-login/auth-google):

1. In Google Auth Platform create a Web OAuth client.
2. Add `https://daniel-techai.github.io` and `http://127.0.0.1:5173` as authorized JavaScript origins.
3. Add the Supabase callback URL shown in **Authentication → Providers → Google** as an authorized redirect URI.
4. Use only the `openid`, email, and profile scopes. NOCTURNE does not request Gmail mailbox access.
5. Paste the Google client ID and secret into the Supabase Google provider and enable it.

For a public consent screen, add the deployed [privacy policy](https://daniel-techai.github.io/CryptoFuck/privacy.html) and [terms](https://daniel-techai.github.io/CryptoFuck/terms.html) to the Google app branding. Google may require brand verification before showing the final public name and logo.

## 4. Connect GitHub Actions

In the repository open **Settings → Secrets and variables → Actions → Variables** and create:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

These are publishable browser values, not secrets. The database's RLS policies are the security boundary.

Then open **Settings → Pages** and choose **GitHub Actions** as the source. The Pages workflow builds the public app and refreshes the closed-candle market snapshot twice per hour. The downloadable-app workflow also creates a 90-day Actions artifact on every push to `main`.

## 5. Verify before sharing

1. Sign in once with Google and once with a magic link.
2. Save a handle and confirm the email is not shown publicly.
3. Place a paper trade, sign in on a second browser, and confirm it syncs.
4. Enable the kill switch and confirm a new order is rejected.
5. Delete a test cloud profile and confirm its paper data disappears.

The install button uses the browser's native PWA flow. On iOS, use **Share → Add to Home Screen**.
