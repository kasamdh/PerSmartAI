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

Installed so far: Expo/Router, `@supabase/supabase-js` (+ `@react-native-async-storage/async-storage`, `react-native-url-polyfill`), `rrule` (date expansion only, see Scheduling), and the lint/test tooling. The remaining stack libraries are approved but not yet installed. Add them with `npx expo install <pkg>` when a feature needs them.

## Folder structure

```
app/                    Expo Router routes only (every file is a screen)
  _layout.tsx           Root stack
  index.tsx             Home / landing
  (auth)/               Sign in, sign up
  (owner)/              Owner screens
  (sitter)/             Sitter screens
  (admin)/              Admin (organization) screens
src/
  components/           Shared UI (e.g. BigButton)
  features/<feature>/   Feature modules: api (queries/mutations), hooks, schemas, components, tests
  lib/                  supabase client, env, utils
  types/                Shared types (incl. generated Supabase DB types)
supabase/
  config.toml           Local Supabase config
  migrations/           SQL migrations (schema + RLS policies)
  functions/            Edge Functions (Deno)
```

Keep non-route code out of `app/`. Route groups don't add a URL segment, so screens in different groups must not share a path (e.g. use `(owner)/owner.tsx`, not `(owner)/index.tsx`).

## Rules

- Every table has `organization_id`; every query is protected by Row Level Security
- Never put secret keys in the app; only the anon key
- All times stored in UTC (`timestamptz`); show in the user's local time zone
- Screens must work one-handed with large tap targets (sitters hold a leash)
- Write tests for business logic; run lint and tests before saying a task is done
- Ask before adding a new library

## Implementation notes

- The `service_role` key only ever lives in Edge Function secrets, never in `.env` or app code.
- Read env vars as literal `process.env.EXPO_PUBLIC_*` accesses (Expo inlines them at build time). Pass them through `requireEnv` in `src/lib/env.ts`.
- RLS is the security boundary. Client-side role checks are UX only.
- Times: instants (visits, check-ins, care events, time off, created_at) are `timestamptz`. Recurring wall-clock times (sitter availability, feeding/medication times, booking windows) are `time` and are interpreted in `organizations.timezone`. Storing those as instants would shift by an hour across DST changes.

## Database conventions

- Migrations live in `supabase/migrations/`, one concern per file. Never edit an applied migration; add a new one.
- Tenant integrity uses composite FKs: child `(parent_id, organization_id)` references parent `(id, organization_id)`. New tables follow the same pattern, plus `unique (id, organization_id)` on any table that others reference.
- `organization_id` defaults to `private.current_org_id()`, so clients never send it.
- RLS helpers (`current_org_id`, `current_app_role`, `is_admin`, `owns_*`, `sitter_can_access_*`) live in the `private` schema, which is not exposed via the API. They are `security definer` with `search_path = ''`. Call them as `(select private.fn())` when they don't depend on the row.
- Column-level rules RLS can't express (sitters only changing visit status and check-in, owners only cancelling bookings, no self-promotion) are enforced by `guard_*` triggers.
- Sitters see `household_access` (entry codes, alarm, wifi) only from 24h before a visit starts until 24h after it ends.
- Storage bucket `pet-media` (private) uses the paths `{org_id}/{visit_id}/{file}` and `{org_id}/pets/{pet_id}/{file}`.
- Every new table needs RLS policies plus cases in `supabase/tests/database/` proving cross-owner, cross-sitter, and cross-org isolation.
- After any schema change, regenerate types with `npm run db:types` (also copies them to `supabase/functions/_shared/` for Edge Functions).

- Owners create bookings only through `public.request_booking(...)` (security invoker, so RLS applies), which inserts the booking, its `booking_pets` and (multi-day) `booking_care_times` atomically and rejects past dates and rules the scheduler can't expand (`private.is_supported_rrule`). Overnight windows are arrival on the start date and departure on the end date, so `window_end < window_start` is allowed for them.
- Setting a booking to `cancelled` cancels its `scheduled` visits that haven't ended (trigger `cancel_visits_on_booking_cancel`); visits already under way are left for the sitter. The trigger sets the transaction-local flag `app.booking_cancel_cascade`, which `guard_visit_update` honors. `stamp_booking_cancellation` records `cancelled_at` and `late_cancellation` (a visit starts within `organizations.cancellation_cutoff_hours`) on the booking and each visit.
- `complete-finished-bookings` (pg_cron, 08:10 UTC) marks confirmed bookings `completed` once their last day has passed in the org timezone and no visit is under way.

## Scheduling

- The scheduler is pure TypeScript in `supabase/functions/_shared/scheduling/` (Jest-tested via `src/features/scheduling`, which re-exports it; Edge Functions import it directly). Callers pass `now`; nothing reads the clock. Relative imports there use `.ts` extensions (Deno); `rrule` is mapped to `npm:rrule` in each function's `deno.json` and is loaded through its CommonJS default export under Deno.
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

- DB triggers (visit status → on_the_way / in_progress / completed, photo insert, incident insert; booking requested → admins, confirmed/declined → owner, cancelled → sitters, admins, and owner except whoever cancelled) call `private.send_push_event`, which POSTs via `pg_net` to the `notify-owner` Edge Function.
- The function URL and service_role JWT come from Vault secrets `edge_functions_url` and `service_role_key`. Local values are in `seed.sql`; production sets its own. If they're missing, nothing is sent.
- `notify-owner` only accepts service_role callers. Wording and booking recipients live in `supabase/functions/_shared/push-messages.ts` (pure TS, tested by Jest). The payload's `data` carries `visitId` or `bookingId`; the app maps it to a screen per role in `src/features/notifications/push-routes.ts`.
- The app registers its Expo push token into `push_tokens` after sign-in and deletes it on sign-out. Remote push needs a development or store build: Expo Go on Android can't receive it, and an EAS project id is required.
- Run functions locally with `npx supabase functions serve`. Edge Function code is Deno and is excluded from `tsc` and ESLint.
- Use `BigButton` (min 56pt height) or an equivalent for primary actions. Put primary actions in the lower half of the screen.
- Expo changes between SDKs. Check the versioned docs (https://docs.expo.dev/versions/v58.0.0/) rather than memory.
- Expo Go only bundles its built-in native modules. A library with custom native code needs a development build.

## Commands

```bash
npx expo start          # dev server (scan QR with Expo Go)
npm run lint            # ESLint
npm run format          # Prettier write (format:check to verify)
npm run typecheck       # tsc --noEmit
npm test                # Jest
npm run check           # lint + format:check + typecheck + test (run before "done")
npx expo install <pkg>  # always use this to add packages (SDK-compatible versions)
npm run db:reset        # re-apply migrations + seed (needs Docker running)
npm run db:test         # pgTAP RLS tests
npm run db:types        # regenerate src/types/database.ts
npx supabase <cmd>      # Supabase CLI (pinned dev dependency); `start` needs Docker
```
