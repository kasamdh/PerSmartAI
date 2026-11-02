// purge-old-media: deletes visit photos and videos older than each organization's
// media_retention_months (null keeps everything). pg_cron (job purge-old-media,
// 08:45 UTC) calls it through private.invoke_edge_function with the service_role JWT.
//
// Files are removed from storage first, then their media rows; tags and hearts go
// with the rows, and incidents keep their text (media_id is set to null). Each run
// handles up to MAX_ROUNDS batches, so a large backlog clears over a few nights.

import { isServiceRole } from '../_shared/service-auth.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

import type { Database } from '../_shared/database.ts';

const BUCKET = 'pet-media';
const BATCH = 500;
const MAX_ROUNDS = 10;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isServiceRole(req)) return json({ error: 'Forbidden' }, 403);

  const admin = createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let deleted = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data: expired, error } = await admin.rpc('list_expired_media', { p_limit: BATCH });
    if (error) return json({ error: error.message, deleted }, 500);
    if (!expired || expired.length === 0) break;

    const paths = expired.flatMap((m) =>
      [m.storage_path, m.thumb_path].filter((p): p is string => !!p),
    );
    for (let i = 0; i < paths.length; i += 100) {
      const { error: removeError } = await admin.storage
        .from(BUCKET)
        .remove(paths.slice(i, i + 100));
      // Missing files aren't an error; anything else stops the run before rows are
      // deleted, so no file is left without a row pointing at it.
      if (removeError) return json({ error: removeError.message, deleted }, 500);
    }

    const ids = expired.map((m) => m.id);
    const { error: deleteError } = await admin.from('media').delete().in('id', ids);
    if (deleteError) return json({ error: deleteError.message, deleted }, 500);
    deleted += ids.length;
    if (expired.length < BATCH) break;
  }

  return json({ deleted });
});
