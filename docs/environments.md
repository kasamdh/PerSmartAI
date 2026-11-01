# Environments and releases

Three environments. Development runs locally; staging and production are separate
Supabase projects, so test data and real clients never mix.

|             | Supabase                       | Mobile build (EAS profile / channel) | App id                          | Admin web         |
| ----------- | ------------------------------ | ------------------------------------ | ------------------------------- | ----------------- |
| Development | local (`npx supabase start`)   | `development` (dev client)           | `com.kasamdh.petsitter.dev`     | `npm run web`     |
| Staging     | `petsitter-staging` project    | `preview`                            | `com.kasamdh.petsitter.preview` | staging deploy    |
| Production  | `petsitter-production` project | `production`                         | `com.kasamdh.petsitter`         | production deploy |

The `e2e` profile is `preview` built for the iOS simulator / an Android APK, for Maestro.

## One-time setup per Supabase project (staging, then production)

1. Create the project (same region as most clients). Note the project ref and the
   database password.
2. Link and push: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
   Never run `seed.sql` against staging or production.
3. Vault secrets used by cron jobs and triggers to call Edge Functions (SQL editor):
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'edge_functions_url');
   select vault.create_secret('<service_role key from Settings > API>', 'service_role_key');
   ```
4. Edge Functions: `npx supabase functions deploy --project-ref <ref>`.
   Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
   Set one secret yourself: `npx supabase secrets set --project-ref <ref> EXPO_ACCESS_TOKEN=<token>`
   (expo.dev > Account settings > Access tokens). Then turn on **Enhanced Security for Push
   Notifications** in the Expo project's settings, so Expo refuses pushes without the token.
5. Auth (Dashboard > Authentication), matching `supabase/config.toml`:
   - Site URL: the admin web URL. Redirect URLs: `petsitter://**` (production) or
     `petsitter-preview://**` / `petsitter-development://**` (staging), plus the admin web URL.
   - Email confirmations **on**. Custom SMTP (the built-in sender is for testing only).
   - Rate limits: sign-ups and sign-ins 15 per 5 min per IP, token verifications 15,
     emails as your SMTP allows. Minimum password length 8. Email OTP expiry 900 s.
   - CAPTCHA:
     1. In Cloudflare > Turnstile, add a widget (Managed mode) whose hostnames include
        the admin site's domain.
     2. In the Supabase dashboard (Authentication > Attack Protection), turn on CAPTCHA
        with provider **Turnstile** and the widget's **secret key**.
     3. Set the **site key** as `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (EAS) and
        `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (admin site).

     The app's check runs in a web view on the admin site's hostname
     (`EXPO_PUBLIC_LEGAL_URL`, or `EXPO_PUBLIC_TURNSTILE_BASE_URL`). Turn the site keys on
     at the same time as the dashboard setting, or sign-in breaks.

   - Multi-Factor: enable **TOTP (App Authenticator)** enroll and verify. Admins can't use
     admin features without it (`private.is_admin()` requires an `aal2` session).
   - Copy the email templates from `supabase/templates/`.
6. Storage: the `pet-media` bucket and its policies come from the migrations; check it
   is private.
7. Database > Backups: production needs Point-in-Time Recovery (Pro plan add-on).

## GitHub

- Repository secret `SUPABASE_ACCESS_TOKEN` (a personal access token for the CLI).
- Environments `staging` and `production` (Settings > Environments), each with secret
  `SUPABASE_DB_PASSWORD` and variable `SUPABASE_PROJECT_REF`. Give `production`
  required reviewers.
- `preview` and `production` environments for EAS Update: secret `EXPO_TOKEN` and
  `SENTRY_AUTH_TOKEN`.
- Workflows: `ci.yml` on every pull request; `deploy-supabase.yml` deploys staging on
  merge and production on a published release; `eas-update.yml` publishes JS updates.

## EAS (mobile)

Environment variables per EAS environment (`eas env:create --environment <env>`):

| Name                             | Visibility | development / preview                 | production                      |
| -------------------------------- | ---------- | ------------------------------------- | ------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`       | plain text | staging URL                           | production URL                  |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`  | plain text | staging anon key                      | production anon key             |
| `EXPO_PUBLIC_SENTRY_DSN`         | plain text | mobile DSN                            | mobile DSN                      |
| `EXPO_PUBLIC_POSTHOG_KEY`        | plain text | staging project key                   | production project key          |
| `EXPO_PUBLIC_POSTHOG_HOST`       | plain text | `https://us.i.posthog.com` or EU      | same                            |
| `EXPO_PUBLIC_LEGAL_URL`          | plain text | staging admin site URL                | production admin site URL       |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY` | plain text | Turnstile site key                    | Turnstile site key              |
| `SENTRY_AUTH_TOKEN`              | secret     | org token                             | org token                       |
| `GOOGLE_SERVICES_JSON`           | file       | Firebase file for `.dev` / `.preview` | Firebase file for the store app |

`EXPO_PUBLIC_*` values are compiled into the app, so only public values go there (the
anon key, DSNs and PostHog project keys are public by design). Never put a
`service_role` or `sb_secret_` key in EAS or `.env` files. CI fails if one appears in a
bundle (`scripts/check-bundle-secrets.mjs`).

Builds: `eas build --profile preview` (testers), `eas build --profile production` then
`eas submit`. Updates: `eas update --channel preview` (CI does this on merge) and, after
testing, run the EAS Update workflow with `production`. The runtime version is the native
fingerprint, so an update only reaches builds with the same native code.

Each app id needs its own Firebase app (for Android push) and its own App Store / Play
listing. The Sentry plugin uploads source maps during EAS builds when
`SENTRY_AUTH_TOKEN` is set; `eas-update.yml` uploads them for updates.

## Admin web hosting

Any Next.js host (Vercel, Netlify, a Node server). Per environment:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SENTRY_DSN`,
`NEXT_PUBLIC_APP_ENV` (`preview` or `production`), and at build time `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG`, `SENTRY_ADMIN_WEB_PROJECT` for source maps (deleted after upload).
Serve over HTTPS only; `next.config.ts` sets HSTS and a CSP.

## Sentry and PostHog projects

- Sentry: projects `petsitter-mobile` and `petsitter-admin-web` in org `petsitter`.
  In each project's settings, turn on "Data Scrubber" and "Use Default Scrubbers", and
  add `address`, `body`, `notes`, `phone`, `email` to the sensitive fields as a second
  layer behind the app's own scrubbing. Turn off "Store Native Crash Reports"
  attachments if not needed.
- PostHog: one project per environment. Under Project settings, turn off autocapture,
  session replay, heatmaps and "Discard client IP data" **on**.
