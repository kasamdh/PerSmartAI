import { z } from 'zod';

import type { Tables, TablesInsert } from '@/types/database';

import { kgToLb, lbToKg, normalizeTimes, TIME_PATTERN } from './logic';

const text = (max: number, tooLong = 'This is too long') => z.string().trim().max(max, tooLong);
const required = (message: string, max = 100) =>
  z.string().trim().min(1, message).max(max, 'This is too long');

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[+\d][\d\s().-]{6,}$/.test(v), 'Enter a valid phone number');

const times = z
  .array(z.string().regex(TIME_PATTERN, 'Use times like 08:00 or 18:30'))
  .max(12, 'That is a lot of times; keep it to 12 or fewer')
  .transform(normalizeTimes);

// ---------------------------------------------------------------------------
// Pet basics
// ---------------------------------------------------------------------------

export const petSchema = z.object({
  name: required('Enter your pet’s name', 50),
  species: z.enum(['dog', 'cat'], { message: 'Choose dog or cat' }),
  breed: text(60),
  birthDate: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use the format YYYY-MM-DD')
    .refine((v) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return true;
      const [y, m, d] = v.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
    }, 'That date doesn’t exist')
    .refine(
      (v) => v === '' || new Date(`${v}T00:00:00`) <= new Date(),
      'Birth date can’t be in the future',
    ),
  weightLb: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (Number(v) > 0 && Number(v) <= 400),
      'Enter a weight between 0.1 and 400 lb',
    ),
  sex: z.enum(['male', 'female', 'unknown']),
  spayedNeutered: z.enum(['yes', 'no', 'unknown']),
  microchip: text(30),
  temperamentNotes: text(1000, 'Keep this under 1000 characters'),
  vetName: text(100),
  vetPhone: optionalPhone,
  vetAddress: text(200),
});
export type PetFormValues = z.input<typeof petSchema>;

export const EMPTY_PET: PetFormValues = {
  name: '',
  species: 'dog',
  breed: '',
  birthDate: '',
  weightLb: '',
  sex: 'unknown',
  spayedNeutered: 'unknown',
  microchip: '',
  temperamentNotes: '',
  vetName: '',
  vetPhone: '',
  vetAddress: '',
};

const nullIfEmpty = (v: string) => (v.trim() === '' ? null : v.trim());

/** Form values → pets row columns (weight stored in kg). */
export function toPetRow(values: PetFormValues) {
  const v = petSchema.parse(values);
  return {
    name: v.name,
    species: v.species,
    breed: nullIfEmpty(v.breed),
    birth_date: nullIfEmpty(v.birthDate),
    weight_kg: v.weightLb === '' ? null : lbToKg(Number(v.weightLb)),
    sex: v.sex,
    spayed_neutered: v.spayedNeutered === 'unknown' ? null : v.spayedNeutered === 'yes',
    microchip: nullIfEmpty(v.microchip),
    temperament_notes: nullIfEmpty(v.temperamentNotes),
    vet_name: nullIfEmpty(v.vetName),
    vet_phone: nullIfEmpty(v.vetPhone),
    vet_address: nullIfEmpty(v.vetAddress),
  } satisfies Partial<TablesInsert<'pets'>>;
}

/** pets row → form values. */
export function fromPetRow(row: Tables<'pets'>): PetFormValues {
  return {
    name: row.name,
    species: row.species,
    breed: row.breed ?? '',
    birthDate: row.birth_date ?? '',
    weightLb: row.weight_kg === null ? '' : String(kgToLb(row.weight_kg)),
    sex: row.sex,
    spayedNeutered: row.spayed_neutered === null ? 'unknown' : row.spayed_neutered ? 'yes' : 'no',
    microchip: row.microchip ?? '',
    temperamentNotes: row.temperament_notes ?? '',
    vetName: row.vet_name ?? '',
    vetPhone: row.vet_phone ?? '',
    vetAddress: row.vet_address ?? '',
  };
}

// ---------------------------------------------------------------------------
// Allergies, medications, feeding
// ---------------------------------------------------------------------------

export const allergySchema = z.object({
  allergen: required('What is the pet allergic to?', 60),
  severity: z.enum(['mild', 'moderate', 'severe'], { message: 'Choose how severe it is' }),
  reactionNotes: text(500, 'Keep this under 500 characters'),
});
export type AllergyFormValues = z.input<typeof allergySchema>;

export const medicationSchema = z.object({
  name: required('Enter the medication name', 80),
  dose: text(60),
  instructions: text(500, 'Keep this under 500 characters'),
  times,
});
export type MedicationFormValues = z.input<typeof medicationSchema>;

export const FOOD_UNITS = ['cup', 'can', 'scoop', 'pouch', 'g', 'oz'] as const;

export const feedingSchema = z.object({
  foodBrand: required('Enter the food brand', 80),
  amount: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (Number(v) > 0 && Number(v) <= 1000),
      'Enter an amount greater than 0',
    ),
  unit: z.enum(FOOD_UNITS),
  times,
  treatsAllowed: z.boolean(),
  notes: text(500, 'Keep this under 500 characters'),
});
export type FeedingFormValues = z.input<typeof feedingSchema>;

// ---------------------------------------------------------------------------
// Household and emergency contacts
// ---------------------------------------------------------------------------

export const householdDetailsSchema = z.object({
  addressLine1: required('Enter your street address', 120),
  addressLine2: text(120),
  city: required('Enter your city', 80),
  region: text(80),
  postalCode: text(20),
  entryInstructions: text(1000, 'Keep this under 1000 characters'),
  alarmNotes: text(500, 'Keep this under 500 characters'),
  wifiName: text(60),
  wifiPassword: text(100),
});
export type HouseholdDetailsValues = z.input<typeof householdDetailsSchema>;

export const contactSchema = z.object({
  name: required('Enter the contact’s name', 100),
  relationship: text(40),
  phone: z.string().trim().min(1, 'Enter a phone number').pipe(optionalPhone),
  isPrimary: z.boolean(),
});
export type ContactFormValues = z.input<typeof contactSchema>;
