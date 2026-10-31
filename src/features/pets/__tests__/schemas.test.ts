import {
  allergySchema,
  contactSchema,
  EMPTY_PET,
  feedingSchema,
  fromPetRow,
  householdDetailsSchema,
  medicationSchema,
  petSchema,
  toPetRow,
} from '../schemas';
import type { Tables } from '@/types/database';

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe('petSchema', () => {
  const valid = { ...EMPTY_PET, name: 'Biscuit', species: 'dog' as const };

  it('needs only a name and species', () => {
    expect(petSchema.safeParse(valid).success).toBe(true);
    expect(messages(petSchema.safeParse({ ...valid, name: '  ' }))).toContain(
      'Enter your pet’s name',
    );
  });

  it('checks birth dates', () => {
    expect(messages(petSchema.safeParse({ ...valid, birthDate: '04/12/2021' }))).toContain(
      'Use the format YYYY-MM-DD',
    );
    expect(messages(petSchema.safeParse({ ...valid, birthDate: '2021-02-30' }))).toContain(
      'That date doesn’t exist',
    );
    expect(messages(petSchema.safeParse({ ...valid, birthDate: '2999-01-01' }))).toContain(
      'Birth date can’t be in the future',
    );
    expect(petSchema.safeParse({ ...valid, birthDate: '2021-04-12' }).success).toBe(true);
  });

  it('checks weight and vet phone', () => {
    expect(messages(petSchema.safeParse({ ...valid, weightLb: '0' }))).toContain(
      'Enter a weight between 0.1 and 400 lb',
    );
    expect(messages(petSchema.safeParse({ ...valid, weightLb: 'heavy' }))).toContain(
      'Enter a weight between 0.1 and 400 lb',
    );
    expect(messages(petSchema.safeParse({ ...valid, vetPhone: 'call' }))).toContain(
      'Enter a valid phone number',
    );
  });
});

describe('toPetRow / fromPetRow', () => {
  it('stores weight in kg, blanks as null, and round-trips', () => {
    const values = {
      ...EMPTY_PET,
      name: ' Rex ',
      species: 'dog' as const,
      weightLb: '79.4',
      spayedNeutered: 'no' as const,
      vetPhone: '+15555550500',
    };
    const row = toPetRow(values);

    expect(row).toMatchObject({
      name: 'Rex',
      weight_kg: 36.02,
      spayed_neutered: false,
      breed: null,
      birth_date: null,
      vet_phone: '+15555550500',
    });

    const back = fromPetRow({ ...(row as unknown as Tables<'pets'>), photo_url: null });
    expect(back).toMatchObject({ name: 'Rex', weightLb: '79.4', spayedNeutered: 'no', breed: '' });
  });

  it('maps "not sure" to unknown', () => {
    expect(toPetRow({ ...EMPTY_PET, name: 'Mochi', species: 'cat' }).spayed_neutered).toBeNull();
  });
});

describe('allergySchema', () => {
  it('requires the allergen and a severity', () => {
    expect(
      allergySchema.safeParse({ allergen: 'Chicken', severity: 'severe', reactionNotes: '' })
        .success,
    ).toBe(true);
    expect(
      messages(allergySchema.safeParse({ allergen: '', severity: 'mild', reactionNotes: '' })),
    ).toContain('What is the pet allergic to?');
    expect(
      messages(allergySchema.safeParse({ allergen: 'X', severity: 'deadly', reactionNotes: '' })),
    ).toContain('Choose how severe it is');
  });
});

describe('medicationSchema', () => {
  it('normalizes and sorts times, allowing "as needed" (no times)', () => {
    expect(
      medicationSchema.parse({
        name: 'Apoquel',
        dose: '',
        instructions: '',
        times: ['18:00', '08:00'],
      }).times,
    ).toEqual(['08:00', '18:00']);
    expect(
      medicationSchema.safeParse({ name: 'Benadryl', dose: '', instructions: '', times: [] })
        .success,
    ).toBe(true);
  });

  it('rejects malformed times and a missing name', () => {
    const result = medicationSchema.safeParse({
      name: '',
      dose: '',
      instructions: '',
      times: ['8am'],
    });
    expect(messages(result)).toEqual(
      expect.arrayContaining(['Enter the medication name', 'Use times like 08:00 or 18:30']),
    );
  });
});

describe('feedingSchema', () => {
  const valid = {
    foodBrand: 'Orijen',
    amount: '3',
    unit: 'cup' as const,
    times: ['08:00'],
    treatsAllowed: true,
    notes: '',
  };

  it('accepts a full plan and an unspecified amount', () => {
    expect(feedingSchema.safeParse(valid).success).toBe(true);
    expect(feedingSchema.safeParse({ ...valid, amount: '' }).success).toBe(true);
  });

  it('rejects zero or negative amounts and a missing brand', () => {
    expect(messages(feedingSchema.safeParse({ ...valid, amount: '-1' }))).toContain(
      'Enter an amount greater than 0',
    );
    expect(messages(feedingSchema.safeParse({ ...valid, foodBrand: '' }))).toContain(
      'Enter the food brand',
    );
  });
});

describe('contactSchema', () => {
  it('requires a name and a valid phone', () => {
    expect(
      contactSchema.safeParse({
        name: 'Nora',
        relationship: 'Neighbor',
        phone: '+15555550301',
        isPrimary: false,
      }).success,
    ).toBe(true);
    expect(
      messages(
        contactSchema.safeParse({ name: 'Nora', relationship: '', phone: '', isPrimary: false }),
      ),
    ).toContain('Enter a phone number');
    expect(
      messages(
        contactSchema.safeParse({ name: '', relationship: '', phone: 'abc', isPrimary: false }),
      ),
    ).toEqual(expect.arrayContaining(['Enter the contact’s name', 'Enter a valid phone number']));
  });
});

describe('householdDetailsSchema', () => {
  it('requires street and city; access notes are optional', () => {
    const empty = {
      addressLine1: '',
      addressLine2: '',
      city: '',
      region: '',
      postalCode: '',
      entryInstructions: '',
      alarmNotes: '',
      wifiName: '',
      wifiPassword: '',
    };
    expect(messages(householdDetailsSchema.safeParse(empty))).toEqual(
      expect.arrayContaining(['Enter your street address', 'Enter your city']),
    );
    expect(
      householdDetailsSchema.safeParse({ ...empty, addressLine1: '12 Maple St', city: 'Brooklyn' })
        .success,
    ).toBe(true);
  });
});
