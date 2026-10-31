import { compressImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

import type { CareEventType } from './care-events';
import { buildPhotoPaths, PET_MEDIA_BUCKET, PHOTO_MAX_WIDTH, THUMB_WIDTH } from './photo-paths';

const VISIT_DETAIL_SELECT = `
  id, status, scheduled_start, scheduled_end, check_in_at, check_out_at, summary_note, organization_id,
  booking:bookings (
    id, service_type, notes,
    household:households (
      id, name, address_line1, address_line2, city, lat, lng,
      household_access ( entry_instructions, alarm_notes, wifi_name, wifi_password ),
      emergency_contacts ( id, name, relationship, phone, is_primary )
    ),
    booking_pets (
      pet:pets (
        id, name, species, breed, temperament_notes, vet_name, vet_phone,
        pet_allergies ( id, allergen, severity, reaction_notes ),
        pet_medications ( id, name, dose, instructions, schedule_times ),
        feeding_plans ( id, food_brand, amount, unit, times, treats_allowed, notes )
      )
    )
  )
` as const;

export async function fetchVisitDetail(visitId: string) {
  const { data, error } = await supabase
    .from('visits')
    .select(VISIT_DETAIL_SELECT)
    .eq('id', visitId)
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export type VisitDetail = Awaited<ReturnType<typeof fetchVisitDetail>>;
export type VisitPet = NonNullable<VisitDetail['booking']['booking_pets'][number]['pet']>;

export async function fetchCareEvents(visitId: string) {
  const { data, error } = await supabase
    .from('care_events')
    .select('id, type, value, occurred_at, created_by, pet:pets ( id, name )')
    .eq('visit_id', visitId)
    .order('occurred_at', { ascending: false });
  if (error) {
    throw error;
  }
  return data;
}

export type CareEventRow = Awaited<ReturnType<typeof fetchCareEvents>>[number];

export async function logCareEvent(input: {
  visitId: string;
  petId: string | null;
  type: CareEventType;
  value?: Json;
}): Promise<void> {
  // organization_id and created_by default server-side from the signed-in user.
  const { error } = await supabase.from('care_events').insert({
    visit_id: input.visitId,
    pet_id: input.petId,
    type: input.type,
    value: input.value ?? {},
  });
  if (error) {
    throw error;
  }
}

export async function deleteCareEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('care_events').delete().eq('id', eventId);
  if (error) {
    throw error;
  }
}

/** Visit photos with short-lived signed thumbnail and full-size URLs (bucket is private). */
export async function fetchVisitPhotos(visitId: string) {
  const { data, error } = await supabase
    .from('media')
    .select('id, storage_path, thumb_path, caption, created_at, pet_id')
    .eq('visit_id', visitId)
    .eq('type', 'photo')
    .order('created_at', { ascending: false });
  if (error) {
    throw error;
  }
  if (data.length === 0) {
    return [];
  }

  const paths = data.flatMap((m) => [m.storage_path, m.thumb_path ?? m.storage_path]);
  const { data: signed, error: signError } = await supabase.storage
    .from(PET_MEDIA_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (signError) {
    throw signError;
  }
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));

  return data.map((m) => ({
    ...m,
    url: urlFor.get(m.storage_path) ?? null,
    thumbUrl: urlFor.get(m.thumb_path ?? m.storage_path) ?? null,
  }));
}

export type VisitPhoto = Awaited<ReturnType<typeof fetchVisitPhotos>>[number];

async function renderJpeg(uri: string, width: number, maxWidth: number, quality: number) {
  return (await compressImage(uri, width, { maxWidth, quality })).data;
}

/** Resizes, uploads (full + thumbnail), and records a visit photo. Cleans up on failure. */
export async function uploadVisitPhoto(input: {
  organizationId: string;
  visitId: string;
  petId: string | null;
  uri: string;
  width: number;
}): Promise<void> {
  const [full, thumb] = await Promise.all([
    renderJpeg(input.uri, input.width, PHOTO_MAX_WIDTH, 0.7),
    renderJpeg(input.uri, input.width, THUMB_WIDTH, 0.6),
  ]);
  const { storagePath, thumbPath } = buildPhotoPaths(input.organizationId, input.visitId);
  const bucket = supabase.storage.from(PET_MEDIA_BUCKET);

  const uploads = await Promise.all([
    bucket.upload(storagePath, full, { contentType: 'image/jpeg' }),
    bucket.upload(thumbPath, thumb, { contentType: 'image/jpeg' }),
  ]);
  const uploadError = uploads.find((u) => u.error)?.error;
  if (uploadError) {
    await bucket.remove([storagePath, thumbPath]);
    throw uploadError;
  }

  const { error } = await supabase.from('media').insert({
    visit_id: input.visitId,
    pet_id: input.petId,
    storage_path: storagePath,
    thumb_path: thumbPath,
    type: 'photo',
  });
  if (error) {
    await bucket.remove([storagePath, thumbPath]);
    throw error;
  }
}
