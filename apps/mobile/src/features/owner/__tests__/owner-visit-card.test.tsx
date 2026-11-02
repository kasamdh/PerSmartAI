import { fireEvent, render, screen } from '@testing-library/react-native';

import type { OwnerVisit } from '../api';
import { OwnerVisitCard } from '../owner-visit-card';

const visit: OwnerVisit = {
  id: 'v1',
  status: 'on_the_way',
  scheduled_start: '2026-10-31T14:00:00Z',
  scheduled_end: '2026-10-31T14:30:00Z',
  check_in_at: null,
  check_out_at: null,
  summary_note: null,
  on_the_way_at: '2026-10-31T13:50:00Z',
  started_at: null,
  status_line: null,
  sitter: { full_name: 'Monika', avatar_url: null },
  booking: {
    service_type: 'drop_in',
    household: { name: "Rudra's home", address_line1: '12 Maple St' },
    booking_pets: [
      { pet: { id: 'p1', name: 'Biscuit', species: 'dog' } },
      { pet: { id: 'p2', name: 'Mochi', species: 'cat' } },
    ],
  },
};

describe('OwnerVisitCard', () => {
  it('shows the live status in plain language', async () => {
    await render(<OwnerVisitCard visit={visit} onOpen={jest.fn()} />);

    expect(screen.getByText('Monika is on the way')).toBeTruthy();
    expect(screen.getByText('Drop-in · Biscuit, Mochi')).toBeTruthy();
    expect(screen.getByText('On the way')).toBeTruthy();
  });

  it('opens the visit as one large button', async () => {
    const onOpen = jest.fn();
    await render(<OwnerVisitCard visit={visit} onOpen={onOpen} />);

    await fireEvent.press(screen.getByRole('button', { name: /Drop-in for Biscuit and Mochi/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('previews the sitter summary on finished visits', async () => {
    await render(
      <OwnerVisitCard
        visit={{ ...visit, status: 'completed', summary_note: 'All good! Good walk.' }}
        onOpen={jest.fn()}
      />,
    );
    expect(screen.getByText('“All good! Good walk.”')).toBeTruthy();
  });
});
