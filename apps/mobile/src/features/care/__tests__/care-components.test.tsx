import { fireEvent, render, screen } from '@testing-library/react-native';

import type { CareEventRow, VisitPet } from '../api';
import { CareTimeline } from '../care-timeline';
import type { ChecklistTask } from '../checklist';
import { PetCarePanel } from '../pet-care-panel';

const cat: VisitPet = {
  id: 'p2',
  name: 'Mochi',
  species: 'cat',
  breed: 'Domestic Shorthair',
  temperament_notes: 'Shy at first.',
  vet_name: null,
  vet_phone: null,
  pet_allergies: [{ id: 'a1', allergen: 'Fish', severity: 'severe', reaction_notes: 'Vomits' }],
  pet_medications: [],
  feeding_plans: [
    {
      id: 'f1',
      food_brand: 'Turkey pate',
      amount: 0.5,
      unit: 'can',
      times: ['08:00:00', '18:00:00'],
      treats_allowed: false,
      notes: null,
    },
  ],
};

const dog: VisitPet = {
  ...cat,
  id: 'p1',
  name: 'Rex',
  species: 'dog',
  pet_allergies: [],
  pet_medications: [
    { id: 'm1', name: 'Apoquel', dose: '16 mg', instructions: null, schedule_times: ['11:00:00'] },
  ],
};

const medTask: ChecklistTask = {
  key: 'medication:m1:2026-11-10T16:00:00.000Z',
  petId: 'p1',
  kind: 'medication',
  title: 'Apoquel 16 mg',
  medicationName: 'Apoquel',
  dueAt: '2026-11-10T16:00:00.000Z',
  dueDate: '2026-11-10',
  dueTime: '11:00',
  status: 'open',
  detail: null,
  eventId: null,
};

const handlers = () => ({
  onFed: jest.fn(),
  onMeds: jest.fn(),
  onLog: jest.fn(),
  onWalk: jest.fn(),
  onNote: jest.fn(),
});

const panel = (
  pet: VisitPet,
  overrides: Partial<React.ComponentProps<typeof PetCarePanel>> = {},
) => (
  <PetCarePanel
    pet={pet}
    tasks={[]}
    walk={null}
    now={new Date('2026-11-10T16:10:00Z')}
    enabled
    {...handlers()}
    {...overrides}
  />
);

describe('PetCarePanel', () => {
  it('shows allergies first, then the feeding plan', async () => {
    await render(panel(cat, { enabled: false }));

    expect(screen.getByTestId('allergy-banner')).toBeTruthy();
    expect(screen.getByText(/Fish · SEVERE/)).toBeTruthy();
    expect(screen.getByText(/0.5 can Turkey pate at 08:00, 18:00 · no treats/)).toBeTruthy();
  });

  it('hides care buttons until the sitter has checked in', async () => {
    await render(panel(cat, { enabled: false }));
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('logs one-tap care, with no walk button for a cat', async () => {
    const onLog = jest.fn();
    const onFed = jest.fn();
    await render(panel(cat, { onLog, onFed }));

    expect(screen.queryByRole('button', { name: 'Start walk with Mochi' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Poop, Mochi' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fed Mochi, ate half' }));
    expect(onLog).toHaveBeenCalledWith('poop');
    expect(onFed).toHaveBeenCalledWith('half', null);
  });

  it('starts and stops a walk with a running timer', async () => {
    const onWalk = jest.fn();
    await render(panel(dog, { onWalk, walk: { startedAt: '2026-11-10T16:03:00Z' } }));
    expect(screen.getByText('Stop walk 7:00')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Stop walk with Rex' }));
    expect(onWalk).toHaveBeenCalled();
  });

  it('checks off medication tasks, or skips them with a reason', async () => {
    const onMeds = jest.fn();
    await render(panel(dog, { onMeds, tasks: [medTask] }));

    expect(screen.getByText(/11:00 AM · Apoquel 16 mg/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Apoquel 16 mg given' }));
    expect(onMeds).toHaveBeenLastCalledWith(medTask, undefined);

    await fireEvent.press(screen.getByRole('button', { name: 'Skip Apoquel 16 mg' }));
    expect(screen.getByRole('button', { name: 'Save skip' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Why was it skipped?'), 'Refused it');
    await fireEvent.press(screen.getByRole('button', { name: 'Save skip' }));
    expect(onMeds).toHaveBeenLastCalledWith(medTask, 'Refused it');
  });

  it('gives the generic Meds given button the next open task', async () => {
    const onMeds = jest.fn();
    await render(panel(dog, { onMeds, tasks: [medTask] }));
    await fireEvent.press(screen.getByRole('button', { name: 'Meds given to Rex: Apoquel 16 mg' }));
    expect(onMeds).toHaveBeenCalledWith(medTask);
  });
});

describe('CareTimeline', () => {
  const events: CareEventRow[] = [
    {
      id: 'e1',
      type: 'fed',
      value: { amount_eaten: 'half' },
      occurred_at: '2026-10-31T14:05:00Z',
      created_by: 'me',
      pet_id: 'p2',
      pet: { id: 'p2', name: 'Mochi' },
    },
    {
      id: 'e2',
      type: 'pee',
      value: {},
      occurred_at: '2026-10-31T14:00:00Z',
      created_by: 'someone-else',
      pet_id: 'p1',
      pet: { id: 'p1', name: 'Biscuit' },
    },
  ];

  it('lists events and lets you remove only your own', async () => {
    const onRemove = jest.fn();
    await render(
      <CareTimeline events={events} canRemove={(e) => e.created_by === 'me'} onRemove={onRemove} />,
    );

    expect(screen.getByText('Mochi ate half')).toBeTruthy();
    expect(screen.getByText('Biscuit peed')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove: Mochi ate half' }));
    expect(onRemove).toHaveBeenCalledWith(events[0]);
  });

  it('shows an empty state', async () => {
    await render(<CareTimeline events={[]} canRemove={() => true} onRemove={jest.fn()} />);
    expect(screen.getByText('Nothing logged yet.')).toBeTruthy();
  });
});
