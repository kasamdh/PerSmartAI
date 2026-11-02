import type { Database } from '@petsitter/shared/database';
import { createBrowserClient } from '@supabase/ssr';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/** The browser client (session in cookies, shared with the server via @supabase/ssr). */
export const supabase = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Client = typeof supabase;
