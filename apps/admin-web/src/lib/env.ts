// Literal process.env.NEXT_PUBLIC_* reads: Next inlines them at build time.
// Only the anon key lives here; RLS is the security boundary.

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy apps/admin-web/.env.example to .env.local.`);
  return value;
}

export const SUPABASE_URL = requireEnv(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);
export const SUPABASE_ANON_KEY = requireEnv(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
