import { fireEvent, render, screen } from '@testing-library/react-native';

import type { SitterVisit } from '../api';
import { VisitCard } from '../visit-card';

const baseVisit: SitterVisit = {
  id: 'v1',
  status: 'scheduled',
  scheduled_start: '2026-10-31T14:00:00Z',
  scheduled_end: '2026-10-31T14:30:00Z',
  check_in_at: null,
  check_out_at: null,
  booking: {
    id: 'b1',
    service_type: 'drop_in',
    notes: null,
    household: {
      id: 'h1',
      name: "Olivia's home",
      address_line1: '12 Maple St',
      address_line2: null,
      city: 'Brooklyn',
      lat: 40.69,
      lng: -73.99,
    },
    booking_pets: [
      { pet: { id: 'p1', name: 'Biscuit', species: 'dog' } },
      { pet: { id: 'p2', name: 'Mochi', species: 'cat' } },
    ],
  },
};

describe('VisitCard', () => {
  it('shows where to go and which pets', async () => {
    await render(<VisitCard visit={baseVisit} onAction={jest.fn()} />);

    expect(screen.getByText("Olivia's home")).toBeTruthy();
    expect(screen.getByText('12 Maple St, Brooklyn')).toBeTruthy();
    expect(screen.getByText('Biscuit (dog) · Mochi (cat)')).toBeTruthy();
    expect(screen.getByText('Scheduled')).toBeTruthy();
  });

  it('offers check in and on my way for a scheduled visit', async () => {
    const onAction = jest.fn();
    await render(<VisitCard visit={baseVisit} onAction={onAction} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'On my way' }));

    expect(onAction.mock.calls).toEqual([['check_in'], ['on_the_way']]);
  });

  it('offers only check out once in progress', async () => {
    await render(
      <VisitCard
        visit={{ ...baseVisit, status: 'in_progress', check_in_at: '2026-10-31T14:02:00Z' }}
        onAction={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Check out' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
    expect(screen.getByText(/Checked in/)).toBeTruthy();
  });

  it('has no actions once completed', async () => {
    await render(<VisitCard visit={{ ...baseVisit, status: 'completed' }} onAction={jest.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disables actions while one is saving', async () => {
    const onAction = jest.fn();
    await render(<VisitCard visit={baseVisit} onAction={onAction} pendingAction="check_in" />);

    await fireEvent.press(screen.getByRole('button', { name: 'On my way' }));
    expect(onAction).not.toHaveBeenCalled();
  });
});
