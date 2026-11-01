// CORS for functions the admin web app calls from the browser. A wildcard origin
// is safe here: callers authenticate with a bearer token (never cookies), so
// another site can't act as the admin without the token.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Answers a preflight request, or null for anything else. */
export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}
