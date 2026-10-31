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
npx supabase <cmd>      # Supabase CLI (pinned dev dependency); `start` needs Docker
```
