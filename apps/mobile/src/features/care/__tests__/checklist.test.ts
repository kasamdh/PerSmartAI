import { buildChecklist, nextOpenTask, type ChecklistPet } from '../checklist';

const NY = 'America/New_York';

// Drop-in 11:00–11:30 New York, Tue Nov 10, 2026.
const visit = {
  scheduled_start: '2026-11-10T16:00:00.000Z',
  scheduled_end: '2026-11-10T16:30:00.000Z',
};

const rex: ChecklistPet = {
  id: 'rex',
  name: 'Rex',
  feeding_plans: [
    {
      id: 'f1',
      food_brand: 'Acme',
      amount: 1,
      unit: 'cup',
      times: ['07:00:00', '11:30:00', '18:00:00'],
    },
  ],
  pet_medications: [
    { id: 'm1', name: 'Apoquel', dose: '16 mg', schedule_times: ['10:30:00', '22:00:00'] },
  ],
};
const mochi: ChecklistPet = {
  id: 'mochi',
  name: 'Mochi',
  feeding_plans: [{ id: 'f2', food_brand: null, amount: null, unit: null, times: ['12:15'] }],
  pet_medications: [],
};

describe('buildChecklist', () => {
  it('gives each pet its own feeding and medication tasks due around the visit', () => {
    const list = buildChecklist(visit, [rex, mochi], NY, []);
    expect(
      list.pets.map((p) => [p.name, p.tasks.map((t) => [t.kind, t.title, t.dueTime, t.status])]),
    ).toEqual([
      [
        'Rex',
        [
          ['medication', 'Apoquel 16 mg', '10:30', 'open'],
          ['feeding', 'Feed 1 cup Acme', '11:30', 'open'],
        ],
      ],
      ['Mochi', [['feeding', 'Feed', '12:15', 'open']]],
    ]);
    expect(list.outstandingMeds.map((t) => t.title)).toEqual(['Apoquel 16 mg']);
  });

  it('keeps pets without tasks in the list', () => {
    const list = buildChecklist(visit, [{ ...mochi, feeding_plans: [] }], NY, []);
    expect(list.pets).toEqual([{ petId: 'mochi', name: 'Mochi', tasks: [] }]);
  });

  it('marks tasks done or skipped from care events with their task key', () => {
    const open = buildChecklist(visit, [rex], NY, []);
    const [med, feed] = open.pets[0].tasks;
    const list = buildChecklist(visit, [rex], NY, [
      { id: 'e1', type: 'fed', pet_id: 'rex', value: { task_key: feed.key, amount_eaten: 'half' } },
      {
        id: 'e2',
        type: 'meds_given',
        pet_id: 'rex',
        value: { task_key: med.key, skipped: true, reason: 'Vomited this morning' },
      },
    ]);
    expect(list.pets[0].tasks.map((t) => [t.title, t.status, t.detail, t.eventId])).toEqual([
      ['Apoquel 16 mg', 'skipped', 'Vomited this morning', 'e2'],
      ['Feed 1 cup Acme', 'done', 'Ate half', 'e1'],
    ]);
    expect(list.outstandingMeds).toEqual([]);
  });

  it('ignores events for other pets or without a task key', () => {
    const open = buildChecklist(visit, [rex], NY, []);
    const list = buildChecklist(visit, [rex], NY, [
      { id: 'e1', type: 'fed', pet_id: 'mochi', value: { task_key: open.pets[0].tasks[1].key } },
      { id: 'e2', type: 'meds_given', pet_id: 'rex', value: {} },
    ]);
    expect(list.pets[0].tasks.every((t) => t.status === 'open')).toBe(true);
  });

  it('lists every feeding across an overnight stay, by day', () => {
    const night = {
      scheduled_start: '2026-11-10T00:30:00.000Z', // Nov 9, 7:30 PM
      scheduled_end: '2026-11-11T13:00:00.000Z', // Nov 11, 8 AM
    };
    const tasks = buildChecklist(
      night,
      [{ ...rex, pet_medications: [] }],
      NY,
      [],
    ).pets[0].tasks.map((t) => `${t.dueDate} ${t.dueTime}`);
    expect(tasks).toEqual([
      '2026-11-10 07:00',
      '2026-11-10 11:30',
      '2026-11-10 18:00',
      '2026-11-11 07:00',
    ]);
  });

  it('reads due times in the business time zone across a DST change', () => {
    // Nov 1, 2026 (fall back): an 11:00–11:30 visit, feeding at 11:30 local.
    const dst = {
      scheduled_start: '2026-11-01T16:00:00.000Z',
      scheduled_end: '2026-11-01T16:30:00.000Z',
    };
    const [task] = buildChecklist(dst, [{ ...rex, pet_medications: [] }], NY, []).pets[0].tasks;
    expect(task.dueAt).toBe('2026-11-01T16:30:00.000Z');
  });

  it('gives tasks stable keys so logged events keep matching', () => {
    const a = buildChecklist(visit, [rex], NY, []).pets[0].tasks.map((t) => t.key);
    const b = buildChecklist(visit, [rex], NY, []).pets[0].tasks.map((t) => t.key);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
});

describe('nextOpenTask', () => {
  it('finds the earliest open task of a kind for the pet', () => {
    const list = buildChecklist(visit, [rex, mochi], NY, []);
    expect(nextOpenTask(list, 'rex', 'feeding')?.title).toBe('Feed 1 cup Acme');
    expect(nextOpenTask(list, 'rex', 'medication')?.title).toBe('Apoquel 16 mg');
    expect(nextOpenTask(list, 'mochi', 'medication')).toBeNull();
  });
});
