# Launch risks

Status as of 2026-11-01, after the production-readiness pass. Ordered by how much
each one should block launch. "Verified" means it was run, not just written.

## Must fix before launch

1. **The end-to-end flows have never run.** `apps/mobile/.maestro` (login, booking,
   sitter visit, report card) was written against the real labels but there was no
   emulator or device to run it. The photo-picker steps depend on the OS version's
   system picker IDs and will likely need adjusting. Run `npm run e2e` on an Android
   emulator and an iOS simulator, fix, then add it to CI (Maestro Cloud or an emulator job).
2. **Staging and production don't exist yet.** The Supabase projects, Vault secrets,
   Auth settings, SMTP, EAS environment variables, GitHub environments, Sentry and
   PostHog projects all have to be created by hand (`docs/environments.md`). The GitHub
   workflows have never run on GitHub; each step was checked locally (db lint, pgTAP,
   gitleaks, Deno check, expo export, bundle scan, web build).
3. **Email confirmation is off** in `supabase/config.toml` (fine locally). Production
   must turn it on, with custom SMTP; otherwise anyone can sign up with someone else's email.
4. **No CAPTCHA.** Sign-in, sign-up and invite lookups are limited per IP only. A
   distributed attacker can still stuff credentials or create spam businesses (business
   sign-up is open to anyone). Turn on Supabase Auth CAPTCHA (Turnstile/hCaptcha) and
   wire the token into both apps' sign-in and sign-up forms (code change needed).
5. **Push is sent without an Expo access token.** Enable Expo "enhanced push security",
   set `EXPO_ACCESS_TOKEN` as a function secret, and send it from `_shared/expo-push.ts`
   (code change needed). Without it, anyone who obtains a device's push token can send
   it notifications that look like they come from the app.
6. **Admins have no second factor.** The admin web shows every client's address, entry
   codes and messages. Require Supabase MFA (TOTP) for the admin role, and add an idle
   timeout to the admin web.
7. **Legal review:** the privacy policy, terms, account-deletion and support pages
   (`docs/legal/`) and the store privacy answers (`docs/store/privacy-labels.md`) are
   drafts. A lawyer must fill the [brackets] and approve them. Also needed: data
   processing agreements with Supabase, Sentry and PostHog, and a data export path for
   privacy requests (deletion exists; export doesn't).
8. **Backups:** turn on Point-in-Time Recovery for production and do one restore
   drill before launch.

## High

- **Never run `supabase db reset --linked`.** It drops the remote database and runs
  `seed.sql` (demo users with `password123`). Deploys only use `db push`. Consider
  restricting who holds the production database password.
- **Home access details are stored as plain text** (`household_access`: entry codes,
  alarm, Wi-Fi). RLS limits who reads them and disks are encrypted, but backups and
  anyone with database access see them. Consider encrypting these columns.
- **The system functions need the legacy `service_role` JWT.** `_shared/service-auth.ts`
  compares the caller's token with `SUPABASE_SERVICE_ROLE_KEY`. If the project moves to
  the new `sb_secret_` keys, the Vault secret and the env var must change together, or
  cron jobs and pushes get 403.
- **The admin CSP allows inline scripts** (`'unsafe-inline'`, needed by Next without
  nonces) and hasn't been tried in a real browser. Check the admin site with the
  browser console open (Realtime, signed images, Sentry) before launch. Moving to a
  nonce-based CSP is the stronger fix.
- **Error-report scrubbing is a backstop, not a guarantee.** Field names and
  email/phone/token patterns are filtered, but free text that is neither (for example,
  an address inside a thrown database error) could reach Sentry. Turn on Sentry's
  server-side data scrubbing as a second layer (`docs/environments.md`).
- **No analytics consent screen.** PostHog events carry no personal data and nobody is
  identified, but the SDK still stores an anonymous device id. EU users may need opt-in
  (ePrivacy); add a setting to turn analytics off.
- **Rate limiting trusts proxy headers.** `private.request_ip()` uses
  `cf-connecting-ip` (hosted Supabase), else the last `X-Forwarded-For` hop. Behind a
  different proxy setup, check that clients can't choose their own IP.
- **Screen readers and large text are checked statically only.** Every touchable has a
  role and every input a label (`npm run a11y:check`), and text colors pass 4.5:1, but
  VoiceOver and TalkBack were never used on a device. The sitter tab bar has a fixed
  72 pt height that may clip labels at the largest text sizes.
- **FlashList v2 in the inverted chat** hasn't been scrolled on a device (keeping
  position when new messages arrive, loading older pages).

## Medium

- **The app icon is a simple generated paw.** It's original and meets the store rules
  (1024 px, no transparency), but a designer should refine it, and make screenshots and
  the Play feature graphic.
- **The admin site is light-only, and so is the app now** (`userInterfaceStyle: light`).
  Dark mode isn't supported.

- **White-label is partial:** buttons, headers, tabs and the logo use the business's
  colors, but many screens still use a fixed blue (`#1565C0`).
- **Payroll counts worked time from check-in to check-out.** A sitter who forgets to
  check out gets 0 worked hours for that visit, and admins can't adjust hours.
- **Changing the business time zone** after visits are scheduled keeps the existing
  visits' instants; they'll show at shifted wall-clock times.
- **No load testing.** RLS helper functions run per row; check query plans and indexes
  on visits, care_events, media and messages at production scale, plus Realtime
  connection limits per plan.
- **No alerting or on-call.** Set Sentry alert rules, Supabase usage and disk alerts,
  and an uptime check for the admin site.
- **npm audit:** 56 moderate and 1 low advisory, all in build-time tooling (glob,
  minimatch, via Expo CLI, Jest, ESLint and Sentry's bundler plugins); no high or
  critical. None of it ships in the app or the site. Upgrade with the next Expo SDK.
- **`google-services.json` is in git.** Its Firebase API key is public by design.
  Restrict it to the app's package names and SHA certificates in Google Cloud. Each app
  variant (`.dev`, `.preview`) needs its own Firebase app for push.

## Done in this pass (for reference)

- RLS on every table; a pgTAP security suite (41 checks): structure, plus attacks
  across businesses and between sitters, all refused. Invite lookups are limited to 10
  per IP per 10 minutes. Auth limits are tightened. System functions require the exact
  service key.
- No secrets in git history apart from the public local demo key (gitleaks), and none
  in the built bundles (`scripts/check-bundle-secrets.mjs`).
- Sentry in both apps, with personal data scrubbed and source maps (debug IDs
  verified in the bundle). PostHog with three allowlisted events. CI on every PR.
  Development, preview and production variants with EAS Update channels.
- FlashList for long lists; images cached by storage path; React Compiler compiles
  every component.
