# Pet Sitter App

## Product

A production, multi-tenant pet sitting app (dogs and cats), sold to pet-sitting businesses. Think of it as a daycare app for pets. Each business is an **organization** (tenant).

Roles:

- **Owner**: adds pets, books visits, receives live status and photos
- **Sitter**: sees their schedule, checks in, logs care, sends photos
- **Admin**: runs a pet-sitting business (organization), manages sitters and all bookings

## Stack (do not change without asking)

- Expo SDK 58 + React Native 0.88 + TypeScript (strict mode)
- Expo Router for navigation (typed routes enabled)
- Supabase: Postgres, Auth, Storage, Realtime, Edge Functions
- TanStack Query for server data, Zustand for small local state
- React Hook Form + Zod for forms and validation
- Expo Notifications, Expo Image Picker, Expo Image Manipulator, Expo Location
- `@react-native-community/datetimepicker` for date and time fields (via `DateTimeField`; native module, so dev builds must be rebuilt after it changes)
- Jest (`jest-expo` preset) + React Native Testing Library for tests
- ESLint (`eslint-config-expo`) + Prettier
- Monorepo: npm workspaces + Turborepo (`apps/*`, `packages/*`; one hoisted React 19.3.0)
- Admin web: Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS 4 + `@supabase/ssr`, TanStack Query
- Sentry (`@sentry/react-native`, `@sentry/nextjs`) for errors; PostHog (`posthog-react-native`) for key events; `@shopify/flash-list` v2 for long lists; `expo-updates` (EAS Update); Maestro for end-to-end flows

Everything above is installed. `rrule` is used for date expansion only (see Scheduling). Add mobile packages with `npx expo install <pkg>` (run in `apps/mobile`), and ask first.

## Folder structure

```
apps/
  mobile/                 Expo app (owners, sitters, admins on the go)
    app/                  Expo Router routes only (every file is a screen)
      (auth)/ (owner)/ (sitter)/ (admin)/ (account)/ ...
    src/
      components/         Shared UI (e.g. BigButton)
      features/<feature>/ Feature modules: api (queries/mutations), hooks, schemas, components, tests
      lib/                supabase client, env, utils
      types/              Re-exports of the shared DB types and models
  admin-web/              Next.js admin site (admins only)
    src/app/              Routes: sign-in, (admin)/ dashboard, schedule, requests, clients, sitters, settings
    src/features/<area>/  api.ts (Supabase calls) + client components per area
    src/lib/              Supabase browser/server clients, env, live queries, formatting
    src/proxy.ts          Session refresh + redirect to /sign-in (Next 16's name for middleware)
packages/
  shared/                 @petsitter/shared: DB types, Zod schemas, scheduling and other pure logic (Jest)
scripts/                  sync-shared, gen-types, check-a11y, check-bundle-secrets, check-functions
docs/                     environments.md (setup runbook), launch-risks.md
.github/workflows/        ci, deploy-supabase, eas-update
apps/mobile/.maestro/     end-to-end flows
supabase/
  config.toml             Local Supabase config
  migrations/             SQL migrations (schema + RLS policies)
  functions/              Edge Functions (Deno)
```

In `apps/mobile`, keep non-route code out of `app/`. Route groups don't add a URL segment, so screens in different groups must not share a path (e.g. use `(owner)/owner.tsx`, not `(owner)/index.tsx`).

## Monorepo and shared code

- `packages/shared` is the single source for logic more than one app uses: DB types (`database.ts`), models, Zod schemas, the scheduler (`scheduling/`), live board, report card, payroll, week board, client search, branding colors, and the schedule-booking client (`schedule-actions.ts`). Import as `@petsitter/shared/<file>` (`@petsitter/shared/scheduling` for the scheduler). It's TypeScript source, not built: Metro and Next (`transpilePackages`) compile it.
- Imports inside `packages/shared` are relative with `.ts` extensions, because Edge Functions (Deno) use some of it.
- Deno only sees `supabase/functions`, so `scripts/sync-shared.mjs` copies `database.ts`, `alerts.ts`, `chat-alerts.ts`, `push-messages.ts` and `scheduling/*` into `supabase/functions/_shared/` with a GENERATED header. Never edit those copies; change the source and run `npm run shared:sync` (`npm run check` fails if they're stale). Files in `_shared/` without the header (`cors.ts`, `expo-push.ts`, `scheduling-data.ts`, ...) belong to the functions only.
- Old mobile paths (`src/features/scheduling`, `src/types/database.ts`, `pets/logic.ts`, ...) re-export from the shared package so existing imports keep working.
- Put new pure business logic in `packages/shared/src` with tests in `src/__tests__`, so both apps can use it.

## Admin web

- Admins only: `app/(admin)/layout.tsx` loads the profile on the server and shows a "for business admins" page to anyone else. That's UX; RLS is the boundary. `proxy.ts` refreshes the Supabase session cookie and sends signed-out visitors to `/sign-in` (password sign-in).
- Env: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `apps/admin-web/.env.local` (see `.env.example`), read as literals in `src/lib/env.ts`. Anon key only.
- Times are shown in `organizations.timezone`, wherever the admin is (`src/lib/format.ts`). Weeks run Monday to Sunday in that zone (`weekRange`).
- Data is read in client components with TanStack Query and the browser client; `useLiveQueries` (`src/lib/live.ts`) refetches on Realtime changes like the mobile app. The layout passes the business to client code through `useOrg()`; after changing settings, `router.refresh()` reloads it.
- Schedule: drag a visit to another sitter or day (`dropChange`), or click it to edit (`editChange`). Every change is previewed with schedule-booking `update_visit` + `preview` and saved the same way, so the server's conflict checks apply. Only `scheduled` visits move, and visits can't be unassigned by dragging.
- Booking requests: `check_sitters` for every sitter, ranked by `rankSitterOptions`, then `confirm`. Reschedule requests use `decide_request`.
- Payroll (`payroll.ts`): per sitter per week, scheduled visits and hours (not cancelled or missed), completed and missed visits, and worked hours (check-in to check-out of completed visits). CSV fields are quoted and guarded against spreadsheet formulas.
- Incidents stay open until an admin resolves them (`resolved_at`, `resolved_by`, `resolution_note`; `guard_incident_resolution` stops anyone else changing those).
- schedule-booking answers CORS preflights (`_shared/cors.ts`; a wildcard origin is fine because callers send a bearer token, not cookies). Any other function the web calls needs the same.

## Branding (white-label)

- `organizations.primary_color` / `accent_color` (`#RRGGBB` or null) and `logo_path` (`{org}/branding/logo-{timestamp}.{png|jpg|webp}` in `pet-media`; every member reads, admins write). Edited on the web Settings page. A new logo gets a new name so phones don't show a cached one, and the old file is removed.
- `brandPalette` (`packages/shared/src/branding.ts`) turns them into colors with readable text (WCAG contrast; pale colors are darkened for text on white). Mobile: `BrandProvider` (root layout) plus `useBrand()` / `useBrandedHeader()` from `src/features/branding/brand-context.ts`. BigButton, stack headers and sitter tabs use them, and `BrandMark` shows the logo and name on the home screens. Shared components import `brand-context.ts`, which has no Supabase import. The web shell sets `--brand` CSS variables (`bg-brand`, `text-on-brand`, `text-brand-ink`).

## Rules

- Every table has `organization_id`; every query is protected by Row Level Security
- Never put secret keys in the app; only the anon key
- All times stored in UTC (`timestamptz`); show in the user's local time zone
- Screens must work one-handed with large tap targets (sitters hold a leash)
- Write tests for business logic; run lint and tests before saying a task is done
- Ask before adding a new library

## Implementation notes

- The `service_role` key only ever lives in Edge Function secrets, never in `.env` or app code.
- Read env vars as literal `process.env.EXPO_PUBLIC_*` accesses (Expo inlines them at build time). Pass them through `requireEnv` in `apps/mobile/src/lib/env.ts`.
- RLS is the security boundary. Client-side role checks are UX only.
- Times: instants (visits, check-ins, care events, time off, created_at) are `timestamptz`. Recurring wall-clock times (sitter availability, feeding/medication times, booking windows) are `time` and are interpreted in `organizations.timezone`. Storing those as instants would shift by an hour across DST changes.

## Database conventions

- Migrations live in `supabase/migrations/`, one concern per file. Never edit an applied migration; add a new one.
- Tenant integrity uses composite FKs: child `(parent_id, organization_id)` references parent `(id, organization_id)`. New tables follow the same pattern, plus `unique (id, organization_id)` on any table that others reference.
- `organization_id` defaults to `private.current_org_id()`, so clients never send it.
- RLS helpers (`current_org_id`, `current_app_role`, `is_admin`, `owns_*`, `sitter_can_access_*`) live in the `private` schema, which is not exposed via the API. They are `security definer` with `search_path = ''`. Call them as `(select private.fn())` when they don't depend on the row.
- Column-level rules RLS can't express (sitters only changing visit status and check-in, owners only cancelling bookings, no self-promotion) are enforced by `guard_*` triggers.
- Sitters see `household_access` (entry codes, alarm, wifi) only from 24h before a visit starts until 24h after it ends.
- Storage bucket `pet-media` (private) uses the paths `{org_id}/{visit_id}/{file}`, `{org_id}/pets/{pet_id}/{file}`, `{org_id}/chat/{household_id}/{file}` and `{org_id}/branding/{file}`.
- Every new table needs RLS policies plus cases in `supabase/tests/database/` proving cross-owner, cross-sitter, and cross-org isolation.
- After any schema change, regenerate types with `npm run db:types` (writes `packages/shared/src/database.ts`, then syncs the copy in `supabase/functions/_shared/`).

- Owners create bookings only through `public.request_booking(...)` (security invoker, so RLS applies), which inserts the booking, its `booking_pets` and (multi-day) `booking_care_times` atomically and rejects past dates and rules the scheduler can't expand (`private.is_supported_rrule`). Overnight windows are arrival on the start date and departure on the end date, so `window_end < window_start` is allowed for them.
- Setting a booking to `cancelled` cancels its `scheduled` visits that haven't ended (trigger `cancel_visits_on_booking_cancel`); visits already under way are left for the sitter. The trigger sets the transaction-local flag `app.booking_cancel_cascade`, which `guard_visit_update` honors. `stamp_booking_cancellation` records `cancelled_at` and `late_cancellation` (a visit starts within `organizations.cancellation_cutoff_hours`) on the booking and each visit.
- `complete-finished-bookings` (pg_cron, 08:10 UTC) marks confirmed bookings `completed` once their last day has passed in the org timezone and no visit is under way.

## Scheduling

- The scheduler is pure TypeScript in `packages/shared/src/scheduling/` (Jest-tested there; the mobile app's `src/features/scheduling` re-exports it; Edge Functions import the synced copy in `_shared/scheduling/`). Callers pass `now`; nothing reads the clock. Relative imports there use `.ts` extensions (Deno); `rrule` is mapped to `npm:rrule` in each function's `deno.json` and is loaded through its CommonJS default export under Deno.
- Recurrence: RRULE subset FREQ=DAILY|WEEKLY, INTERVAL, BYDAY, UNTIL or COUNT (`recurrence.ts`). `rrule` only expands dates (floating UTC-midnight); `time-zone.ts` converts wall-clock times in the org timezone, so a 12:00 walk stays 12:00 across DST. Times skipped by spring-forward move past the gap; repeated fall-back times use the first one. `private.is_supported_rrule` mirrors the parser in SQL.
- Visit plans (`visit-plan.ts`): drop-in/walk one visit per occurrence; overnight one visit from arrival to departure; multi-day one visit per care time per day. Generated 60 days ahead (`SCHEDULE_HORIZON_DAYS`). Each visit has `slot_start` (unique per booking) identifying its occurrence; moving a visit keeps the slot, so regeneration never recreates moved or cancelled visits.
- Conflicts (`conflicts.ts`, `schedule-check.ts`): overlap, travel buffer (`organizations.travel_buffer_minutes`, none between visits at the same home), approved time off, and sitter availability (wall-clock, adjacent blocks join) block; requested time off and no availability set are warnings. Whole bookings are checked up to a year ahead by projecting the sitter's other confirmed bookings past the stored window. Every conflict has a readable reason (`describeConflict`).
- Series edits (`series.ts`): one visit changes only that visit; "this and future" splits the booking (original ends the day before, a new booking in the same `series_id` takes over, keeping every-other-week parity and remaining COUNT; cancelled dates carry over).
- Writes: the `schedule-booking` Edge Function (caller's JWT, so RLS applies) runs the checks and calls `apply_booking_plan` (confirm/reassign), `reschedule_booking` (this and future), `update_visit_schedule` (move/reassign one visit). These RPCs are admin-only and re-check overlap, buffer and approved time off under a per-sitter advisory lock (`23P01` with a reason). Actions: `check_sitters`, `confirm`, `reschedule`, `update_visit`, `decide_request`.
- Nightly: pg_cron `generate-visits` (08:15 UTC) calls the `generate-visits` Edge Function (service_role) via `private.invoke_edge_function`; `store_generated_visits` adds only missing slots and leaves visits the sitter can no longer take unassigned for an admin.
- Owners reschedule through `schedule_change_requests` (one visit, or this and future); admins approve (applied with conflict checks) or decline. Sitters request time off (`sitter_time_off.status`), admins approve.
- Lists use `useLiveQueries` (`src/lib/realtime.ts`) to refetch on Realtime changes; bookings, visits, care times, availability, time off and change requests are in the publication.

## Visit flow

- Status flow `scheduled -> on_the_way -> arrived -> in_progress -> completed`, enforced by `private.visit_transition_allowed` in the `track_visit_status` trigger for every signed-in user (admins may also mark `missed` before check-in or `cancelled` before completion; system jobs and the booking-cancel cascade are exempt). `src/features/visits/visit-status.ts` mirrors it for the buttons; keep both in sync.
- The app moves visits only through `public.advance_visit(visit_id, status, lat, lng, summary)` (security invoker). The server records `on_the_way_at`, `check_in_at` (arrived), `started_at` (in_progress) and `check_out_at`. Check-in is `arrived`; the first care event starts care (`start_care_on_first_event`), and checking out from `arrived` steps through `in_progress`. Check-in warns, never blocks, beyond 200 m (`src/lib/geo.ts`).
- Care events can only be logged while a visit is `arrived` or `in_progress`. Checklist tasks (`src/features/care/checklist.ts`) come from feeding plans and medications due during the visit or within an hour of it, in the org timezone; events complete a task through `value.task_key`. Skipped meds are `meds_given` with `skipped: true` and a `reason`. Check-out requires every medication task done or skipped (app rule). Walks: a `walk` event with `started_at`, updated with `ended_at` and `minutes` when stopped.
- `visits.status_line` is the sitter's live one-liner for the owner (cleared when the visit ends). Incidents can link a photo (`incidents.media_id`).
- Owner report card: `src/features/care/report-card.ts`. Admin live board: `src/features/admin/live-board.ts` (late = not checked in 10 minutes after the start).

## Photos and videos

- Sitters capture with expo-camera (photos, videos up to 15 s) or pick up to 10 from the gallery. Photos are compressed to 1080 px wide at JPEG 0.7; every item gets a 300 px JPEG thumbnail (videos: first frame). Paths: `{org}/{visit}/{uuid}.jpg|.mp4|.mov` and `{uuid}-thumb.jpg`. Tags go in `media_pets`.
- Everything a sitter captures, and every care tap, goes through the offline queue (`src/features/media/upload-queue.ts`, pure and tested; device wiring in `queue-runtime.ts`, persisted in AsyncStorage per user, files in `Paths.document/media-queue`). Items keep the id made on the phone, so a retried upload that already arrived returns 409/23505 and counts as sent. The queue retries when signal returns, on foreground, and on backoff (30 s doubling to 10 min, 5 tries).
- Care events that happened during a visit are accepted after check-out (they may sync late), but nothing timed after check-out.
- Owners see media through signed URLs that expire after 1 hour (thumbnails in lists, full size on tap), never public URLs. They can heart (`media_reactions`) and save to the phone (expo-media-library `Asset.create`; the legacy save API throws in SDK 58).
- `organizations.media_retention_months` (null keeps everything): `purge-old-media` (pg_cron 08:45 UTC) deletes expired files, then their rows.

## Chat

- One conversation per household (`messages.household_id`). Participants: the owner, the business's admins, and sitters with a non-cancelled visit there in the last 30 or next 30 days. `private.can_chat(household_id)` decides, and the messages, `conversation_reads` and storage (`{org}/chat/{household_id}/{file}`) policies all use it. Messages can't be edited; senders and admins can delete.
- Read receipts are per participant: `conversation_reads.read_at` (only moves forward). `my_conversations()` and `unread_message_count()` (security invoker) feed the list and the badges (sitters: Messages tab; owners and admins: Messages button).
- Messages load newest first in pages of 30 with keyset paging on `(created_at, id)`; live via Realtime. Photos use the same 1080 px / 300 px / JPEG 0.7 compression.
- Push: the insert trigger calls notify-owner, which alerts at once unless the conversation had an alert in the last minute; `alert-checks` (every minute) sends the rest as one alert (`_shared/chat-alerts.ts`, tested). People who've already read the messages aren't alerted. Screens are in the `(account)` group: `/messages` and `/messages/[householdId]`.

## Auth and routing

- Sessions are stored in expo-secure-store, chunked to stay under its value size limit (`src/lib/secure-storage.ts`), with a fixed `storageKey`. The client uses the PKCE flow.
- Sign-in: password, or an email with a magic link plus a 6-digit code (the code works even when the link can't reach the device). Password reset works the same way. Email templates are in `supabase/templates/`.
- Sign-up creates profiles in the `private.handle_new_user` trigger, based on signUp metadata: `{signup_type:'business', business_name, timezone}` creates an org and admin, `{invite_code}` joins that invite's org and role. Without either, no profile is created.
- `invites` (admin-only RLS); `public.check_invite(code)` is the only public lookup. Codes are 8 characters with no look-alikes.
- All routing rules live in `src/features/auth/routing.ts` (`resolveDestination` + `routeGuards`, tested). Route groups: `(auth)`, `reset-password`, `(onboarding)` (owners without a household), `(owner)`, `(sitter)`, `(admin)`, `(account)` (profile, delete account). Only the current user's group exists.
- Account deletion goes through the `delete-account` Edge Function. Deleting an owner removes their household data. Deleting a sitter keeps visit history, detached from them. The last admin of a business with members is refused.

## Pets

- `src/features/pets`: TanStack Query hooks (`hooks.ts`), Supabase calls (`api.ts`), Zod schemas with row mappers (`schemas.ts`), and pure helpers (`logic.ts`: allergy banner, age, lb/kg, times, tel links).
- The shared `PetDetailScreen` is mounted per role at `/pets/[id]` (owner, editable), `/sitter-pet/[id]` and `/admin-pet/[id]` (read-only). Use `petRouteFor(role, id)`.
- `AllergyBanner` must stay the first element of every pet view. It has no dismiss or collapse, and severe allergies are bold.
- Weight is entered in lb and stored as `weight_kg`. Medication and feeding times are `HH:MM` wall-clock values.
- Pet photos are compressed on-device to 1080px by `PhotoPicker` and stored at `{org}/pets/{pet_id}/{file}`. Replacing a photo deletes the old file.
- `set_primary_emergency_contact(id)` (security invoker) switches the one primary contact atomically.

## Push notifications

- Pushes are sent only by Edge Functions through the Expo Push API (`_shared/expo-push.ts`), never from the app. The app registers its Expo push token in `push_tokens` after sign-in and deletes it on sign-out. Remote push needs a development or store build and an EAS project id.
- Event pushes: database triggers call `private.send_push_event` (pg_net) → `notify-owner`. Visit status (on the way, arrived, completed with report card), incidents (owner and admins, always immediate), bookings (requested → admins; confirmed/declined → owner; cancelled → sitters, admins, owner except whoever cancelled), sitter schedule changes (booking assigned/unassigned/changed; one visit reassigned, moved or cancelled by an admin; not system jobs), and "not eating" (two refused meals in a row by `occurred_at`, alerting owner and admins once).
- Timed alerts: pg_cron calls `alert-checks` every minute (`{job:'photos'}`: one "Max: 4 new photos" alert per visit at most every 5 minutes, after a 30 s settle) and every 5 minutes (`{job:'checks'}`: sitter reminders 30 minutes before, late check-ins 15 minutes after the start to owner and admins, medication due during overnight/multi-day stays). Decisions are pure in `_shared/alerts.ts` (Jest-tested); `notification_log` (service_role only) makes each alert go out once.
- Alert kinds and their settings labels live in `_shared/alerts.ts`. Users mute kinds in `notification_settings.muted` (own row only); `incident` can't be muted. Wording is in `_shared/push-messages.ts`. The payload's `data` carries `visitId` or `bookingId` plus `type`; `src/features/notifications/push-routes.ts` maps it to a screen per role.
- Run functions locally with `npx supabase functions serve`. Edge Function code is Deno and isn't part of any workspace's `tsc` or ESLint.
- Use `BigButton` (min 56pt height) or an equivalent for primary actions. Put primary actions in the lower half of the screen.
- Expo changes between SDKs. Check the versioned docs (https://docs.expo.dev/versions/v58.0.0/) rather than memory.
- Expo Go only bundles its built-in native modules. A library with custom native code needs a development build.

## Security, telemetry and releases

- `supabase/tests/database/security_audit.test.sql` fails if any public table lacks RLS, policies or `organization_id`, if `anon` gets a table grant, if a definer function doesn't pin `search_path`, or if anything besides `check_invite` is callable signed out. Keep it passing; add attack cases for new tables.
- Public RPCs that could be brute-forced call `private.hit_rate_limit(bucket, private.request_ip(), max, window)` (HTTP 429 via SQLSTATE `PT429`). `check_invite`: 10 per IP per 10 minutes. Auth limits are in `[auth.rate_limit]` and must match the hosted dashboard.
- System-only Edge Functions (cron, triggers) check the caller with `_shared/service-auth.ts` (exact service key, constant time). Functions the web calls answer CORS with `_shared/cors.ts`.
- Error reports: everything goes through `packages/shared/src/telemetry-scrub.ts` (`beforeSend` / `beforeBreadcrumb`). No default PII, screenshots, view hierarchy, session replay or console breadcrumbs. Never pass addresses, messages, notes or contact details to `reportError` / `captureException` context.
- Analytics: only the events in `packages/shared/src/analytics-events.ts`, through `track()` (`apps/mobile/src/lib/analytics.ts`). Properties are allowlisted enums, booleans and rounded counts; nobody is identified. Add an event there (with a test) before tracking it.
- Both are off unless their keys are set (`EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_SENTRY_DSN`), and the mobile app never sends either in development (`__DEV__`).
- Variants: `APP_VARIANT` = development / preview / production picks the app id, name and deep-link scheme (`app.config.ts`); `EXPO_PUBLIC_APP_ENV` tags reports. EAS profiles and channels: `eas.json`. Setup runbook: `docs/environments.md`. Open launch risks: `docs/launch-risks.md`.
- CI (`.github/workflows/ci.yml`) on every PR: `npm run check`, web build, mobile JS export plus the bundle secret scan, Supabase from scratch with db lint, pgTAP and a generated-types diff, a guard against editing applied migrations, Deno type check of the functions, gitleaks.
- Accessibility: `npm run a11y:check` (in `npm run check`) requires a role on every touchable, a label on every input and switch, and a label or `accessible={false}` on every image. Text colors must reach 4.5:1 on their background (the default brand blue is `#1565C0`; muted text `#666666`).
- Remote images use `cachedImageSource(url)` (`src/lib/image-cache.ts`) with `cachePolicy="memory-disk"`, so re-signed URLs reuse the cached file. Unbounded lists use FlashList.

## Store release

- Store config lives in `apps/mobile/app.json` (base) + `app.config.ts` (per variant). `src/__tests__/app-config.test.ts` guards ids, plain-language permission texts and **no background location**: location is a one-shot foreground read at check-in/out (`src/lib/location.ts`). Don't add background modes, "Always" location, or Android `READ_MEDIA_*` (the photo picker needs none; saving is write-only) without updating the privacy labels.
- Notifications: `push-explainer.ts` shows a plain explanation per role before the one-time system prompt; "Not now" waits a week.
- Legal pages are Markdown in `docs/legal/` (privacy, terms, account deletion, support; drafts for a lawyer), served publicly by the admin site at `/privacy`, `/terms`, `/account-deletion`, `/support` (excluded from the proxy). The app links to them via `EXPO_PUBLIC_LEGAL_URL`. Keep them true to what the app stores.
- Store answers: `docs/store/privacy-labels.md` (Apple labels, Google Data Safety), `app-review-notes.md`, `release-checklist.md`. App Review demo: `npm run demo:create` (own business, resets its data, always a visit today).
- Owner account deletion removes their visit, pet and chat files from storage (`delete-account`).

## Commands

Run from the repo root unless noted.

```bash
npm run mobile          # Expo dev server for apps/mobile (scan QR with Expo Go)
npm run web             # admin web dev server on http://localhost:3001
npm run web:build       # next build for apps/admin-web
npm run lint            # ESLint in every workspace (turbo)
npm run format          # Prettier write (format:check to verify)
npm run typecheck       # tsc --noEmit in every workspace (turbo)
npm test                # Jest in every workspace (turbo)
npm run check           # shared:check + a11y:check + lint + format:check + typecheck + test (run before "done")
npm run shared:sync     # copy shared logic into supabase/functions/_shared
npm run functions:check # Deno type check of every Edge Function (needs Deno)
npm run secrets:check -- <dirs>  # fail if a built bundle contains a non-anon key
npm run e2e             # Maestro flows against the seeded backend (emulator + e2e build)
cd apps/mobile && npx expo install <pkg>   # add mobile packages (SDK-compatible versions)
npm install <pkg> -w @petsitter/admin-web  # add web packages
npm run db:reset        # re-apply migrations + seed (needs Docker running)
npm run db:test         # pgTAP RLS tests
npm run db:types        # regenerate packages/shared/src/database.ts (and sync it)
npx supabase <cmd>      # Supabase CLI (pinned dev dependency); `start` needs Docker
```
