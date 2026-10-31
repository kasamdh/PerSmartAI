import type { Enums, Tables } from './database';

// Friendly aliases over the generated Supabase types. Regenerate database.ts with
// `npm run db:types`; never edit it by hand.
export type AppRole = Enums<'app_role'>;
export type Profile = Tables<'profiles'>;
