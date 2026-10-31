import type { Enums, Json } from '@/types/database';

import type { VisitStatus } from '@/features/visits/visit-actions';

export type CareEventType = Enums<'care_event_type'>;
export type Species = Enums<'pet_species'>;
export type FedAmount = 'all' | 'half' | 'none';

export const FED_AMOUNTS: { value: FedAmount; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'half', label: 'Half' },
  { value: 'none', label: 'None' },
];

type CareButton = { type: Exclude<CareEventType, 'note'>; label: string };

const ALL_BUTTONS: CareButton[] = [
  { type: 'fed', label: 'Fed' },
  { type: 'water', label: 'Water' },
  { type: 'pee', label: 'Pee' },
  { type: 'poop', label: 'Poop' },
  { type: 'walk', label: 'Walk' },
  { type: 'meds_given', label: 'Meds given' },
  { type: 'play', label: 'Play' },
  { type: 'vomit', label: 'Vomit' },
];

/** One-tap care buttons for a pet: walks are for dogs, meds only if the pet has any. */
export function careButtonsFor(species: Species, hasMedications: boolean): CareButton[] {
  return ALL_BUTTONS.filter(
    (b) => (b.type !== 'walk' || species === 'dog') && (b.type !== 'meds_given' || hasMedications),
  );
}

/** Care can be logged once the sitter has checked in and until they check out. */
export function canLogCare(status: VisitStatus): boolean {
  return status === 'arrived' || status === 'in_progress';
}

function field(value: Json, key: string): string | number | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value[key];
    if (typeof v === 'string' || typeof v === 'number') {
      return v;
    }
  }
  return undefined;
}

/** One-line, owner-friendly description of a care event, e.g. "Biscuit ate half". */
export function careEventSummary(
  type: CareEventType,
  value: Json,
  petName?: string | null,
): string {
  const pet = petName ?? 'Pet';
  switch (type) {
    case 'fed': {
      const amount = field(value, 'amount_eaten');
      if (amount === 'none') return `${pet} didn't eat`;
      return amount ? `${pet} ate ${amount}` : `Fed ${pet}`;
    }
    case 'water':
      return `${pet} got fresh water`;
    case 'pee':
      return `${pet} peed`;
    case 'poop':
      return `${pet} pooped`;
    case 'walk': {
      const minutes = field(value, 'minutes');
      return minutes ? `Walked ${pet} · ${minutes} min` : `Walked ${pet}`;
    }
    case 'meds_given':
      return `${pet} got their meds`;
    case 'play':
      return `Played with ${pet}`;
    case 'vomit':
      return `${pet} vomited`;
    case 'note':
      return String(field(value, 'text') ?? 'Note');
  }
}
