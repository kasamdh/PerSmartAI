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
- Jest (`jest-expo` preset) + React Native Testing Library for tests
- ESLint (`eslint-config-expo`) + Prettier

Installed so far: Expo/Router, `@supabase/supabase-js` (+ `@react-native-async-storage/async-storage`, `react-native-url-polyfill`), and the lint/test tooling. The remaining stack libraries are approved but not yet installed. Add them with `npx expo install <pkg>` when a feature needs them.

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

- Visits are generated from bookings only by `public.confirm_booking(booking_id, sitter_id)` (admin-only RPC). It converts wall-clock booking times in the org timezone to UTC in Postgres (DST-safe), supports no rule / FREQ=DAILY / FREQ=WEEKLY;BYDAY=..., generates 90 days ahead, and is idempotent (unique `(booking_id, scheduled_start)`). Re-confirming reassigns upcoming visits.

## Auth and routing

- Sessions are stored in expo-secure-store, chunked to stay under its value size limit (`src/lib/secure-storage.ts`), with a fixed `storageKey`. The client uses the PKCE flow.
- Sign-in: password, or an email with a magic link plus a 6-digit code (the code works even when the link can't reach the device). Password reset works the same way. Email templates are in `supabase/templates/`.
- Sign-up creates profiles in the `private.handle_new_user` trigger, based on signUp metadata: `{signup_type:'business', business_name, timezone}` creates an org and admin, `{invite_code}` joins that invite's org and role. Without either, no profile is created.
- `invites` (admin-only RLS); `public.check_invite(code)` is the only public lookup. Codes are 8 characters with no look-alikes.
- All routing rules live in `src/features/auth/routing.ts` (`resolveDestination` + `routeGuards`, tested). Route groups: `(auth)`, `reset-password`, `(onboarding)` (owners without a household), `(owner)`, `(sitter)`, `(admin)`, `(account)` (profile, delete account). Only the current user's group exists.
- Account deletion goes through the `delete-account` Edge Function. Deleting an owner removes their household data. Deleting a sitter keeps visit history, detached from them. The last admin of a business with members is refused.

## Push notifications

- DB triggers (visit status → on_the_way / in_progress / completed, photo insert, incident insert) call `private.send_push_event`, which POSTs via `pg_net` to the `notify-owner` Edge Function.
- The function URL and service_role JWT come from Vault secrets `edge_functions_url` and `service_role_key`. Local values are in `seed.sql`; production sets its own. If they're missing, nothing is sent.
- `notify-owner` only accepts service_role callers. Wording lives in `supabase/functions/_shared/push-messages.ts` (pure TS, tested by Jest).
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
