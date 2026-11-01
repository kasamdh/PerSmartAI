import type { Enums } from './database.ts';

export type AllergySeverity = Enums<'allergy_severity'>;

// ---------------------------------------------------------------------------
// Allergy banner
// ---------------------------------------------------------------------------

type AllergyLike = { allergen: string; severity: AllergySeverity; reaction_notes?: string | null };

export type AllergyBanner = {
  items: {
    allergen: string;
    severity: AllergySeverity;
    notes: string | null;
    emphasized: boolean;
  }[];
  hasSevere: boolean;
  /** One sentence for screen readers, e.g. "Allergies: Chicken (severe), Fish (mild)". */
  accessibilityLabel: string;
};

const SEVERITY_ORDER: Record<AllergySeverity, number> = { severe: 0, moderate: 1, mild: 2 };

/**
 * The red banner shown at the top of every pet detail view. Returns null only when
 * there are no allergies. Severe allergies come first and are emphasized (bold).
 */
export function allergyBanner(allergies: AllergyLike[] | null | undefined): AllergyBanner | null {
  if (!allergies || allergies.length === 0) return null;
  const items = [...allergies]
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.allergen.localeCompare(b.allergen),
    )
    .map((a) => ({
      allergen: a.allergen,
      severity: a.severity,
      notes: a.reaction_notes?.trim() || null,
      emphasized: a.severity === 'severe',
    }));
  return {
    items,
    hasSevere: items.some((i) => i.emphasized),
    accessibilityLabel: `Allergies: ${items.map((i) => `${i.allergen} (${i.severity})`).join(', ')}`,
  };
}

// ---------------------------------------------------------------------------
// Age, weight, times, phone
// ---------------------------------------------------------------------------

/** "3 years", "1 year", "7 months", "5 weeks", "New"; null without a birth date. */
export function petAge(
  birthDate: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const born = new Date(y, m - 1, d);
  if (Number.isNaN(born.getTime()) || born > now) return null;

  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;

  if (months >= 12) {
    const years = Math.floor(months / 12);
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }
  if (months >= 1) return `${months} ${months === 1 ? 'month' : 'months'}`;
  const weeks = Math.floor((now.getTime() - born.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return weeks >= 1 ? `${weeks} ${weeks === 1 ? 'week' : 'weeks'}` : 'New';
}

const KG_PER_LB = 0.45359237;

export function lbToKg(lb: number): number {
  return Math.round(lb * KG_PER_LB * 100) / 100;
}

export function kgToLb(kg: number): number {
  return Math.round((kg / KG_PER_LB) * 10) / 10;
}

/** Quick picks for medication and feeding times (wall-clock, business time zone). */
export const TIME_PRESETS = [
  { label: 'Morning', time: '07:00' },
  { label: 'Midday', time: '12:00' },
  { label: 'Evening', time: '18:00' },
  { label: 'Bedtime', time: '21:00' },
] as const;

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "8:00", "08:00:00" → "08:00"; returns null for anything that isn't a time. */
export function normalizeTime(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const value = `${match[1].padStart(2, '0')}:${match[2]}`;
  return TIME_PATTERN.test(value) ? value : null;
}

/** Normalizes, de-duplicates, and sorts a list of times; drops invalid entries. */
export function normalizeTimes(times: readonly string[]): string[] {
  const set = new Set(times.map(normalizeTime).filter((t): t is string => t !== null));
  return [...set].sort();
}

/** "08:00" → "8:00 AM". */
export function formatTimeOfDay(time: string): string {
  const t = normalizeTime(time);
  if (!t) return time;
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** tel: URL with only dialable characters, or null if there's nothing to dial. */
export function telUrl(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^\d+]/g, '');
  return digits.replace(/\+/g, '').length >= 3 ? `tel:${digits}` : null;
}
