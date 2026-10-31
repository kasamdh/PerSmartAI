import {
  removeFromPetMedia,
  uniqueJpegName,
  uploadToPetMedia,
  type CompressedImage,
} from '@/lib/images';
import { supabase } from '@/lib/supabase';

import {
  allergySchema,
  contactSchema,
  feedingSchema,
  householdDetailsSchema,
  medicationSchema,
  toPetRow,
  type AllergyFormValues,
  type ContactFormValues,
  type FeedingFormValues,
  type HouseholdDetailsValues,
  type MedicationFormValues,
  type PetFormValues,
} from './schemas';

const nullIfEmpty = (v: string) => (v.trim() === '' ? null : v.trim());

// ---------------------------------------------------------------------------
// Pets
// ---------------------------------------------------------------------------

/** Pets the signed-in user can see (RLS: owner's own, sitter's assigned, admin's org). */
export async function fetchPets() {
  const { data, error } = await supabase
    .from('pets')
    .select('id, name, species, breed, birth_date, photo_url, pet_allergies ( severity )')
    .order('name');
  if (error) throw error;
  return data;
}

export type PetListItem = Awaited<ReturnType<typeof fetchPets>>[number];

const PET_DETAIL_SELECT = `
  *,
  pet_allergies ( id, allergen, severity, reaction_notes ),
  pet_medications ( id, name, dose, instructions, schedule_times ),
  feeding_plans ( id, food_brand, amount, unit, times, treats_allowed, notes ),
  household:households (
    id, name,
    emergency_contacts ( id, name, relationship, phone, is_primary )
  )
` as const;

export async function fetchPet(petId: string) {
  const { data, error } = await supabase
    .from('pets')
    .select(PET_DETAIL_SELECT)
    .eq('id', petId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type PetDetail = NonNullable<Awaited<ReturnType<typeof fetchPet>>>;

/** The owner's household (one per owner today), needed to add pets. */
export async function fetchOwnHousehold(ownerId: string) {
  const { data, error } = await supabase
    .from('households')
    .select(
      `id, name, address_line1, address_line2, city, region, postal_code,
       household_access ( id, entry_instructions, alarm_notes, wifi_name, wifi_password ),
       emergency_contacts ( id, name, relationship, phone, is_primary )`,
    )
    .eq('owner_id', ownerId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type OwnHousehold = NonNullable<Awaited<ReturnType<typeof fetchOwnHousehold>>>;

function petPhotoPath(organizationId: string, petId: string) {
  return `${organizationId}/pets/${petId}/${uniqueJpegName()}`;
}

/** Creates or updates a pet; uploads a new photo (and removes the old one) if given. */
export async function savePet(input: {
  petId?: string;
  householdId: string;
  organizationId: string;
  values: PetFormValues;
  photo?: CompressedImage | null;
  previousPhotoPath?: string | null;
}): Promise<string> {
  const row = toPetRow(input.values);

  let petId = input.petId;
  if (petId) {
    const { error } = await supabase.from('pets').update(row).eq('id', petId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('pets')
      .insert({ ...row, household_id: input.householdId })
      .select('id')
      .single();
    if (error) throw error;
    petId = data.id;
  }

  if (input.photo) {
    const path = petPhotoPath(input.organizationId, petId);
    await uploadToPetMedia(path, input.photo.data);
    const { error } = await supabase.from('pets').update({ photo_url: path }).eq('id', petId);
    if (error) {
      await removeFromPetMedia([path]);
      throw error;
    }
    if (input.previousPhotoPath) {
      await removeFromPetMedia([input.previousPhotoPath]).catch(() => {});
    }
  }
  return petId;
}

export async function deletePet(pet: { id: string; photo_url: string | null }): Promise<void> {
  const { error } = await supabase.from('pets').delete().eq('id', pet.id);
  if (error) throw error;
  if (pet.photo_url) await removeFromPetMedia([pet.photo_url]).catch(() => {});
}

// ---------------------------------------------------------------------------
// Allergies, medications, feeding
// ---------------------------------------------------------------------------

export async function saveAllergy(petId: string, values: AllergyFormValues, id?: string) {
  const v = allergySchema.parse(values);
  const row = {
    allergen: v.allergen,
    severity: v.severity,
    reaction_notes: nullIfEmpty(v.reactionNotes),
  };
  const { error } = id
    ? await supabase.from('pet_allergies').update(row).eq('id', id)
    : await supabase.from('pet_allergies').insert({ ...row, pet_id: petId });
  if (error) throw error;
}

export async function deleteAllergy(id: string) {
  const { error } = await supabase.from('pet_allergies').delete().eq('id', id);
  if (error) throw error;
}

export async function saveMedication(petId: string, values: MedicationFormValues, id?: string) {
  const v = medicationSchema.parse(values);
  const row = {
    name: v.name,
    dose: nullIfEmpty(v.dose),
    instructions: nullIfEmpty(v.instructions),
    schedule_times: v.times,
  };
  const { error } = id
    ? await supabase.from('pet_medications').update(row).eq('id', id)
    : await supabase.from('pet_medications').insert({ ...row, pet_id: petId });
  if (error) throw error;
}

export async function deleteMedication(id: string) {
  const { error } = await supabase.from('pet_medications').delete().eq('id', id);
  if (error) throw error;
}

export async function saveFeedingPlan(petId: string, values: FeedingFormValues, id?: string) {
  const v = feedingSchema.parse(values);
  const row = {
    food_brand: v.foodBrand,
    amount: v.amount === '' ? null : Number(v.amount),
    unit: v.unit,
    times: v.times,
    treats_allowed: v.treatsAllowed,
    notes: nullIfEmpty(v.notes),
  };
  const { error } = id
    ? await supabase.from('feeding_plans').update(row).eq('id', id)
    : await supabase.from('feeding_plans').insert({ ...row, pet_id: petId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Household and emergency contacts
// ---------------------------------------------------------------------------

export async function saveHouseholdDetails(
  household: OwnHousehold,
  values: HouseholdDetailsValues,
) {
  const v = householdDetailsSchema.parse(values);
  const { error } = await supabase
    .from('households')
    .update({
      address_line1: v.addressLine1,
      address_line2: nullIfEmpty(v.addressLine2),
      city: v.city,
      region: nullIfEmpty(v.region),
      postal_code: nullIfEmpty(v.postalCode),
    })
    .eq('id', household.id);
  if (error) throw error;

  const access = {
    entry_instructions: nullIfEmpty(v.entryInstructions),
    alarm_notes: nullIfEmpty(v.alarmNotes),
    wifi_name: nullIfEmpty(v.wifiName),
    wifi_password: nullIfEmpty(v.wifiPassword),
  };
  const existing = household.household_access[0];
  const { error: accessError } = existing
    ? await supabase.from('household_access').update(access).eq('id', existing.id)
    : await supabase.from('household_access').insert({ ...access, household_id: household.id });
  if (accessError) throw accessError;
}

export async function saveContact(householdId: string, values: ContactFormValues, id?: string) {
  const v = contactSchema.parse(values);
  const row = { name: v.name, relationship: nullIfEmpty(v.relationship), phone: v.phone };
  let contactId = id;
  if (id) {
    const { error } = await supabase.from('emergency_contacts').update(row).eq('id', id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({ ...row, household_id: householdId, is_primary: false })
      .select('id')
      .single();
    if (error) throw error;
    contactId = data.id;
  }
  if (v.isPrimary && contactId) {
    await setPrimaryContact(contactId);
  }
}

export async function setPrimaryContact(contactId: string) {
  const { error } = await supabase.rpc('set_primary_emergency_contact', {
    p_contact_id: contactId,
  });
  if (error) throw error;
}

export async function deleteContact(id: string) {
  const { error } = await supabase.from('emergency_contacts').delete().eq('id', id);
  if (error) throw error;
}
