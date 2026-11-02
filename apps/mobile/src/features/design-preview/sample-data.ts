import type { HomePet, HomeVisit } from '@/features/owner/owner-home-view';

// Made-up data for the Design Preview (dev only). Times are relative to now so
// the "happening now" and "coming up" sections always have something to show.

const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();

const pets = {
  max: { id: 'p-max', name: 'Max', species: 'dog' },
  luna: { id: 'p-luna', name: 'Luna', species: 'cat' },
};

export const samplePets: HomePet[] = [
  {
    ...pets.max,
    breed: 'Beagle',
    birth_date: '2022-04-10',
    pet_allergies: [
      { allergen: 'Chicken', severity: 'severe', reaction_notes: 'Vomiting' },
      { allergen: 'Pollen', severity: 'mild' },
    ],
  },
  { ...pets.luna, breed: 'Tabby', birth_date: '2019-08-01', pet_allergies: [] },
];

const visit = (
  id: string,
  status: HomeVisit['status'],
  start: number,
  service: string,
  extra: Partial<HomeVisit> = {},
): HomeVisit => ({
  id,
  status,
  scheduled_start: at(start),
  scheduled_end: at(start + 0.5),
  check_in_at:
    status === 'arrived' || status === 'in_progress' || status === 'completed' ? at(start) : null,
  check_out_at: status === 'completed' ? at(start + 0.5) : null,
  status_line: null,
  summary_note: null,
  sitter: { full_name: 'Monika Pokhrel' },
  booking: { service_type: service, booking_pets: [{ pet: pets.max }] },
  ...extra,
});

export const sampleVisitGroups = {
  active: [
    visit('v-now', 'in_progress', -0.2, 'walk', {
      status_line: 'Out at the park, Max is loving it',
    }),
  ],
  upcoming: [
    visit('v-1', 'scheduled', 20, 'drop_in', {
      booking: { service_type: 'drop_in', booking_pets: [{ pet: pets.max }, { pet: pets.luna }] },
    }),
    visit('v-2', 'scheduled', 44, 'walk'),
  ],
  recent: [
    visit('v-past', 'completed', -24, 'drop_in', {
      summary_note: 'Max ate all his food and we had a great walk.',
    }),
  ],
};
