// System-only functions (cron jobs, database triggers) are called through
// private.invoke_edge_function with the service_role key from Vault. Requiring
// that exact key, instead of reading `role` from an unverified JWT payload, keeps
// them closed even if one is ever deployed with --no-verify-jwt.

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isServiceRole(req: Request): boolean {
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!expected) return false;
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  return token.length > 0 && constantTimeEqual(token, expected);
}
