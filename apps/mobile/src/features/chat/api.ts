import { JPEG_QUALITY, PHOTO_MAX_WIDTH, THUMB_WIDTH, uuidv4 } from '@/features/media/media-logic';
import { compressImage, PET_MEDIA_BUCKET } from '@/lib/images';
import { supabase } from '@/lib/supabase';

import { PAGE_SIZE, type Cursor } from './chat-logic';

// RLS (private.can_chat) limits everything here to conversations the user takes
// part in: their household (owners), households they visit within 30 days
// (sitters), or every household in the business (admins).

export async function fetchConversations() {
  const { data, error } = await supabase.rpc('my_conversations');
  if (error) throw error;
  return data;
}

export type Conversation = Awaited<ReturnType<typeof fetchConversations>>[number];

export async function fetchUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_message_count');
  if (error) throw error;
  return data ?? 0;
}

/** One page of a household's messages, newest first, with signed photo URLs (1 hour). */
export async function fetchMessagesPage(householdId: string, before?: Cursor) {
  let query = supabase
    .from('messages')
    .select(
      'id, sender_id, body, photo_path, photo_thumb_path, photo_width, photo_height, created_at, sender:profiles ( full_name, role )',
    )
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);
  if (before) {
    // Keyset paging: strictly older than the last message of the previous page.
    query = query.or(
      `created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`,
    );
  }
  const { data, error } = await query;
  if (error) throw error;

  const paths = data.flatMap((m) =>
    m.photo_path ? [m.photo_path, m.photo_thumb_path ?? m.photo_path] : [],
  );
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed, error: signError } = await supabase.storage
      .from(PET_MEDIA_BUCKET)
      .createSignedUrls([...new Set(paths)], 60 * 60);
    if (signError) throw signError;
    signed.forEach((s) => s.signedUrl && s.path && urls.set(s.path, s.signedUrl));
  }
  return data.map((m) => ({
    ...m,
    photoUrl: m.photo_path ? (urls.get(m.photo_path) ?? null) : null,
    thumbUrl: m.photo_path ? (urls.get(m.photo_thumb_path ?? m.photo_path) ?? null) : null,
  }));
}

export type ChatMessage = Awaited<ReturnType<typeof fetchMessagesPage>>[number];

export async function sendText(householdId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) return;
  const { error } = await supabase
    .from('messages')
    .insert({ household_id: householdId, body: text });
  if (error) throw error;
}

/** Compresses (1080 px, JPEG 0.7, 300 px thumbnail), uploads, then posts the photo. */
export async function sendPhoto(input: {
  organizationId: string;
  householdId: string;
  uri: string;
  width: number;
  caption?: string;
}): Promise<void> {
  const [full, thumb] = await Promise.all([
    compressImage(input.uri, input.width, { maxWidth: PHOTO_MAX_WIDTH, quality: JPEG_QUALITY }),
    compressImage(input.uri, input.width, { maxWidth: THUMB_WIDTH, quality: JPEG_QUALITY }),
  ]);
  const id = uuidv4();
  const folder = `${input.organizationId}/chat/${input.householdId}`;
  const photoPath = `${folder}/${id}.jpg`;
  const thumbPath = `${folder}/${id}-thumb.jpg`;
  const bucket = supabase.storage.from(PET_MEDIA_BUCKET);

  const uploads = await Promise.all([
    bucket.upload(photoPath, full.data, { contentType: 'image/jpeg' }),
    bucket.upload(thumbPath, thumb.data, { contentType: 'image/jpeg' }),
  ]);
  const uploadError = uploads.find((u) => u.error)?.error;
  if (uploadError) {
    await bucket.remove([photoPath, thumbPath]);
    throw uploadError;
  }
  const { error } = await supabase.from('messages').insert({
    household_id: input.householdId,
    body: input.caption?.trim() || null,
    photo_path: photoPath,
    photo_thumb_path: thumbPath,
    photo_width: full.width,
    photo_height: full.height,
  });
  if (error) {
    await bucket.remove([photoPath, thumbPath]);
    throw error;
  }
}

/** Marks the conversation read up to now (read_at only moves forward). */
export async function markRead(householdId: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_reads')
    .upsert(
      { household_id: householdId, read_at: new Date().toISOString() },
      { onConflict: 'household_id,user_id' },
    );
  if (error) throw error;
}

/** Everyone's read_at in this conversation, for read receipts. */
export async function fetchReads(householdId: string) {
  const { data, error } = await supabase
    .from('conversation_reads')
    .select('user_id, read_at, user:profiles ( full_name )')
    .eq('household_id', householdId);
  if (error) throw error;
  return data.map((r) => ({
    user_id: r.user_id,
    read_at: r.read_at,
    name: r.user?.full_name ?? 'Someone',
  }));
}
