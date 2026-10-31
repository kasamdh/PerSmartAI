import { fireEvent, render, screen } from '@testing-library/react-native';

import type { CareEventRow, VisitPet } from '../api';
import { CareTimeline } from '../care-timeline';
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

describe('PetCarePanel', () => {
  it('shows allergies and the feeding plan up front', async () => {
    await render(<PetCarePanel pet={cat} onLog={null} />);

    expect(screen.getByText(/Allergy: Fish \(severe\)/)).toBeTruthy();
    expect(screen.getByText(/0.5 can Turkey pate at 08:00, 18:00 · no treats/)).toBeTruthy();
  });

  it('hides care buttons until the sitter can log', async () => {
    await render(<PetCarePanel pet={cat} onLog={null} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('logs the tapped care type, with no walk button for a cat', async () => {
    const onLog = jest.fn();
    await render(<PetCarePanel pet={cat} onLog={onLog} />);

    expect(screen.queryByRole('button', { name: 'Walk, Mochi' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Poop, Mochi' }));
    expect(onLog).toHaveBeenCalledWith('poop');
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
      pet: { id: 'p2', name: 'Mochi' },
    },
    {
      id: 'e2',
      type: 'pee',
      value: {},
      occurred_at: '2026-10-31T14:00:00Z',
      created_by: 'someone-else',
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
