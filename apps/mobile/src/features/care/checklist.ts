// The sitter's task checklist for a visit, built from each pet's feeding plans and
// medications. Times are wall-clock in the business's zone; a task is due when its
// time falls during the visit or within an hour of it (see dueInstants). Tasks are
// completed by care events carrying their `task_key`.

import { dueInstants } from '@/features/scheduling/calendar';
import type { Json } from '@/types/database';

import type { FedAmount } from './care-events';

export type ChecklistPet = {
  id: string;
  name: string;
  feeding_plans: readonly {
    id: string;
    food_brand: string | null;
    amount: number | null;
    unit: string | null;
    times: readonly string[];
  }[];
  pet_medications: readonly {
    id: string;
    name: string;
    dose: string | null;
    schedule_times: readonly string[];
  }[];
};

export type TaskKind = 'feeding' | 'medication';

export type ChecklistTask = {
  key: string;
  petId: string;
  kind: TaskKind;
  title: string;
  /** For medication events: what the owner sees in the report card. */
  medicationName: string | null;
  dueAt: string;
  dueDate: string;
  dueTime: string;
  status: 'open' | 'done' | 'skipped';
  /** "Ate half", or the reason a medication was skipped. */
  detail: string | null;
  eventId: string | null;
};

export type Checklist = {
  pets: { petId: string; name: string; tasks: ChecklistTask[] }[];
  /** Medication tasks still neither given nor skipped; check-out waits for these. */
  outstandingMeds: ChecklistTask[];
};

type EventLike = { id: string; type: string; pet_id: string | null; value: Json };

const AMOUNT_TEXT: Record<FedAmount, string> = {
  all: 'Ate all',
  half: 'Ate half',
  none: 'Didn’t eat',
};

function obj(value: Json): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

const hhmm = (time: string) => time.slice(0, 5);

export function buildChecklist(
  visit: { scheduled_start: string; scheduled_end: string },
  pets: readonly ChecklistPet[],
  timeZone: string,
  events: readonly EventLike[],
): Checklist {
  const byKey = new Map<string, EventLike>();
  for (const e of events) {
    const key = obj(e.value).task_key;
    if (typeof key === 'string') byKey.set(`${e.pet_id}|${key}`, e);
  }

  const result = pets.map((pet) => {
    const tasks: ChecklistTask[] = [];
    const add = (
      kind: TaskKind,
      sourceId: string,
      time: string,
      title: string,
      medicationName: string | null,
    ) => {
      for (const { date, at } of dueInstants(visit, time, timeZone)) {
        const key = `${kind}:${sourceId}:${at.toISOString()}`;
        const event = byKey.get(`${pet.id}|${key}`);
        const wanted = kind === 'feeding' ? 'fed' : 'meds_given';
        const v = event && event.type === wanted ? obj(event.value) : null;
        const skipped = v?.skipped === true;
        tasks.push({
          key,
          petId: pet.id,
          kind,
          title,
          medicationName,
          dueAt: at.toISOString(),
          dueDate: date,
          dueTime: hhmm(time),
          status: v ? (skipped ? 'skipped' : 'done') : 'open',
          detail: !v
            ? null
            : skipped
              ? typeof v.reason === 'string'
                ? v.reason
                : 'Skipped'
              : kind === 'feeding' && typeof v.amount_eaten === 'string'
                ? (AMOUNT_TEXT[v.amount_eaten as FedAmount] ?? null)
                : null,
          eventId: v && event ? event.id : null,
        });
      }
    };

    for (const plan of pet.feeding_plans) {
      const food = [plan.amount, plan.unit, plan.food_brand].filter((p) => p !== null && p !== '');
      const title = food.length ? `Feed ${food.join(' ')}` : 'Feed';
      for (const time of plan.times) add('feeding', plan.id, time, title, null);
    }
    for (const med of pet.pet_medications) {
      const title = [med.name, med.dose].filter(Boolean).join(' ');
      for (const time of med.schedule_times) add('medication', med.id, time, title, med.name);
    }
    tasks.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.title.localeCompare(b.title));
    return { petId: pet.id, name: pet.name, tasks };
  });

  return {
    pets: result,
    outstandingMeds: result.flatMap((p) =>
      p.tasks.filter((t) => t.kind === 'medication' && t.status === 'open'),
    ),
  };
}

/** The earliest open task of a kind for a pet, so one-tap buttons complete it. */
export function nextOpenTask(
  checklist: Checklist,
  petId: string,
  kind: TaskKind,
): ChecklistTask | null {
  return (
    checklist.pets
      .find((p) => p.petId === petId)
      ?.tasks.find((t) => t.kind === kind && t.status === 'open') ?? null
  );
}
