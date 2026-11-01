// The owner's report card after check-out: what each pet ate, potty breaks, walks,
// medications, and the sitter's notes, built from the visit's care events.

import type { Json } from './database.ts';

export type FedAmount = 'all' | 'half' | 'none';

type EventLike = { type: string; pet_id: string | null; value: unknown; occurred_at: string };

export type PetReport = {
  petId: string;
  name: string;
  meals: FedAmount[];
  water: number;
  pee: number;
  poop: number;
  /** Finished walks (a walk still under way has no minutes yet). */
  walks: number;
  walkMinutes: number;
  play: number;
  vomit: number;
  meds: { name: string; status: 'given' | 'skipped'; reason: string | null }[];
  notes: string[];
};

export type ReportCard = { pets: PetReport[]; notes: string[] };

function obj(value: unknown): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

export function buildReportCard(
  events: readonly EventLike[],
  pets: readonly { id: string; name: string }[],
): ReportCard {
  const sorted = [...events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const notes: string[] = [];
  const reports = pets.map((p): PetReport => ({
    petId: p.id,
    name: p.name,
    meals: [],
    water: 0,
    pee: 0,
    poop: 0,
    walks: 0,
    walkMinutes: 0,
    play: 0,
    vomit: 0,
    meds: [],
    notes: [],
  }));

  for (const e of sorted) {
    const v = obj(e.value);
    const report = reports.find((r) => r.petId === e.pet_id);
    if (e.type === 'note') {
      const text = typeof v.text === 'string' ? v.text.trim() : '';
      if (text) (report ? report.notes : notes).push(text);
      continue;
    }
    if (!report) continue;
    switch (e.type) {
      case 'fed':
        if (v.amount_eaten === 'all' || v.amount_eaten === 'half' || v.amount_eaten === 'none') {
          report.meals.push(v.amount_eaten);
        }
        break;
      case 'water':
        report.water++;
        break;
      case 'pee':
        report.pee++;
        break;
      case 'poop':
        report.poop++;
        break;
      case 'walk':
        if (typeof v.minutes === 'number') {
          report.walks++;
          report.walkMinutes += v.minutes;
        }
        break;
      case 'play':
        report.play++;
        break;
      case 'vomit':
        report.vomit++;
        break;
      case 'meds_given':
        report.meds.push({
          name: typeof v.medication_name === 'string' ? v.medication_name : 'medication',
          status: v.skipped === true ? 'skipped' : 'given',
          reason: typeof v.reason === 'string' ? v.reason : null,
        });
        break;
    }
  }
  return { pets: reports, notes };
}

/** Short lines for one pet, e.g. "Potty: peed 2×, pooped 1×". */
export function reportCardLines(report: PetReport): string[] {
  const lines: string[] = [];
  if (report.meals.length) lines.push(`Ate: ${report.meals.join(', ')}`);
  if (report.water) lines.push(`Fresh water ${report.water}×`);
  const potty = [
    report.pee ? `peed ${report.pee}×` : null,
    report.poop ? `pooped ${report.poop}×` : null,
  ].filter(Boolean);
  if (potty.length) lines.push(`Potty: ${potty.join(', ')}`);
  if (report.walks) lines.push(`Walks: ${report.walks} (${report.walkMinutes} min)`);
  if (report.meds.length) {
    lines.push(
      `Meds: ${report.meds
        .map((m) =>
          m.status === 'given'
            ? `${m.name} given`
            : `${m.name} skipped (${m.reason ?? 'no reason'})`,
        )
        .join(', ')}`,
    );
  }
  if (report.play) lines.push(`Played ${report.play}×`);
  if (report.vomit) lines.push(`Vomited ${report.vomit}×`);
  return lines.length ? lines : ['Nothing logged'];
}
