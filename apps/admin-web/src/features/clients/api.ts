import { PET_MEDIA_BUCKET } from '@/lib/storage';
import { supabase } from '@/lib/supabase/client';

export const clientKeys = {
  all: ['clients'] as const,
  detail: (id: string) => ['clients', id] as const,
};

/** Every household in the business with its owner and pets. */
export async function fetchClients() {
  const { data, error } = await supabase
    .from('households')
    .select(
      `id, name, address_line1, city,
       owner:profiles ( full_name, phone ),
       pets ( id, name, species, breed )`,
    )
    .order('created_at');
  if (error) throw error;
  return data;
}

export type Client = Awaited<ReturnType<typeof fetchClients>>[number];

/** A household's full profile: home, access, contacts, pets with care details, bookings. */
export async function fetchClient(householdId: string, now: Date) {
  const [household, access, contacts, pets, bookings, visits] = await Promise.all([
    supabase
      .from('households')
      .select(
        'id, name, address_line1, address_line2, city, region, postal_code, country_code, created_at, owner:profiles ( id, full_name, phone )',
      )
      .eq('id', householdId)
      .maybeSingle(),
    supabase
      .from('household_access')
      .select('entry_instructions, alarm_notes, wifi_name, wifi_password')
      .eq('household_id', householdId)
      .maybeSingle(),
    supabase
      .from('emergency_contacts')
      .select('id, name, phone, relationship, is_primary')
      .eq('household_id', householdId)
      .order('is_primary', { ascending: false }),
    supabase
      .from('pets')
      .select(
        `id, name, species, breed, sex, birth_date, weight_kg, spayed_neutered, microchip, photo_url,
         temperament_notes, vet_name, vet_phone, vet_address,
         pet_allergies ( id, allergen, severity, reaction_notes ),
         pet_medications ( id, name, dose, instructions, schedule_times ),
         feeding_plans ( id, food_brand, amount, unit, times, treats_allowed, notes )`,
      )
      .eq('household_id', householdId)
      .order('name'),
    supabase
      .from('bookings')
      .select(
        'id, status, service_type, recurrence_rule, start_date, end_date, window_start, window_end, sitter:profiles ( full_name )',
      )
      .eq('household_id', householdId)
      .order('start_date', { ascending: false })
      .limit(20),
    supabase
      .from('visits')
      .select(
        'id, status, scheduled_start, scheduled_end, sitter:profiles ( full_name ), booking:bookings!inner ( service_type, household_id )',
      )
      .eq('booking.household_id', householdId)
      .gte('scheduled_start', new Date(now.getTime() - 14 * 86_400_000).toISOString())
      .neq('status', 'cancelled')
      .order('scheduled_start')
      .limit(30),
  ]);
  for (const result of [household, access, contacts, pets, bookings, visits]) {
    if (result.error) throw result.error;
  }
  if (!household.data) return null;

  const paths = (pets.data ?? []).map((p) => p.photo_url).filter((p): p is string => !!p);
  const photos = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from(PET_MEDIA_BUCKET).createSignedUrls(paths, 60 * 60);
    for (const item of data ?? [])
      if (item.path && item.signedUrl) photos.set(item.path, item.signedUrl);
  }

  return {
    household: household.data,
    access: access.data,
    contacts: contacts.data ?? [],
    pets: (pets.data ?? []).map((p) => ({
      ...p,
      photoUrl: p.photo_url ? (photos.get(p.photo_url) ?? null) : null,
    })),
    bookings: bookings.data ?? [],
    visits: visits.data ?? [],
  };
}

export type ClientProfile = NonNullable<Awaited<ReturnType<typeof fetchClient>>>;
