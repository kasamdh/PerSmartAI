// delete-account: permanently deletes the calling user's account (App Store requirement).
//
// The caller is identified from their own JWT. Rules (see migration 20261031000006):
//   owner  → auth user deleted; households, pets, bookings, visits, care logs cascade.
//            Their visit photos and pet photos are removed from storage first.
//   sitter → auth user deleted; visit history stays with the business, detached.
//   admin  → refused while other members remain and no other admin exists.
//            A solo admin's whole business (and its files) is deleted.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import type { Database } from '../_shared/database.ts';

const BUCKET = 'pet-media';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** All object paths under a prefix (storage lists one folder level at a time). */
async function listAll(admin: SupabaseClient<Database>, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const { data } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id === null) {
      paths.push(...(await listAll(admin, path))); // folder
    } else {
      paths.push(path);
    }
  }
  return paths;
}

async function removeFiles(admin: SupabaseClient<Database>, paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in' }, 401);

  const admin = createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: 'Not signed in' }, 401);

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role === 'admin') {
    const [{ count: others }, { count: otherAdmins }] = await Promise.all([
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .neq('id', user.id),
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('role', 'admin')
        .neq('id', user.id),
    ]);

    if ((others ?? 0) > 0 && (otherAdmins ?? 0) === 0) {
      return json(
        {
          error:
            'You are the only admin of your business. Make another team member an admin before deleting your account.',
          code: 'last_admin',
        },
        409,
      );
    }
    if ((others ?? 0) === 0) {
      await removeFiles(admin, await listAll(admin, profile.organization_id));
      const { error } = await admin
        .from('organizations')
        .delete()
        .eq('id', profile.organization_id);
      if (error) return json({ error: error.message }, 500);
    }
  }

  if (profile?.role === 'owner') {
    const { data: households } = await admin
      .from('households')
      .select('id, pets ( id ), bookings ( visits ( media ( storage_path, thumb_path ) ) )')
      .eq('owner_id', user.id);

    const paths: string[] = [];
    for (const h of households ?? []) {
      for (const b of h.bookings) {
        for (const v of b.visits) {
          for (const m of v.media) {
            paths.push(m.storage_path);
            if (m.thumb_path) paths.push(m.thumb_path);
          }
        }
      }
      for (const pet of h.pets) {
        paths.push(...(await listAll(admin, `${profile.organization_id}/pets/${pet.id}`)));
      }
    }
    await removeFiles(admin, paths);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ deleted: true });
});
