import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { SitterVisit } from '../api';
import { arrivalWindowText, VisitCard } from '../visit-card';

jest.mock('@/features/pets/pet-avatar', () => ({
  PetAvatar: ({ name }: { name: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`avatar:${name}`}</Text>;
  },
}));

const NY = 'America/New_York';

// 10:00–10:30 New York.
const baseVisit: SitterVisit = {
  id: 'v1',
  status: 'scheduled',
  scheduled_start: '2026-10-31T14:00:00Z',
  scheduled_end: '2026-10-31T14:30:00Z',
  check_in_at: null,
  check_out_at: null,
  care_time: null,
  booking: {
    id: 'b1',
    service_type: 'drop_in',
    notes: null,
    window_start: '10:00:00',
    window_end: '12:00:00',
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
      {
        pet: {
          id: 'p1',
          name: 'Biscuit',
          species: 'dog',
          photo_url: null,
          pet_allergies: [{ allergen: 'Chicken', severity: 'severe' }],
          feeding_plans: [{ times: ['10:15:00', '18:00:00'] }],
          pet_medications: [{ schedule_times: ['09:30:00'] }],
        },
      },
      {
        pet: {
          id: 'p2',
          name: 'Mochi',
          species: 'cat',
          photo_url: null,
          pet_allergies: [],
          feeding_plans: [],
          pet_medications: [],
        },
      },
    ],
  },
};

describe('VisitCard', () => {
  it('shows the pets, where to go, the window, service and tasks', async () => {
    await render(<VisitCard visit={baseVisit} onAction={jest.fn()} timeZone={NY} />);

    expect(screen.getByText("Olivia's home")).toBeTruthy();
    expect(screen.getByText('avatar:Biscuit')).toBeTruthy();
    expect(screen.getByText('avatar:Mochi')).toBeTruthy();
    expect(screen.getByText('Biscuit, Mochi')).toBeTruthy();
    expect(screen.getByText('Drop-in · Arrive 10:00 AM–12:00 PM')).toBeTruthy();
    expect(screen.getByText('2 tasks')).toBeTruthy(); // 10:15 feeding, 9:30 meds
    expect(screen.getByText('Scheduled')).toBeTruthy();
  });

  it('warns about allergies', async () => {
    await render(<VisitCard visit={baseVisit} onAction={jest.fn()} timeZone={NY} />);
    expect(screen.getByLabelText('Allergy warning. Biscuit: Chicken (severe)')).toBeTruthy();
  });

  it('opens directions when the address is tapped', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<VisitCard visit={baseVisit} onAction={jest.fn()} timeZone={NY} />);

    await fireEvent.press(
      screen.getByRole('link', { name: 'Directions to 12 Maple St, Brooklyn' }),
    );
    expect(open).toHaveBeenCalledWith(expect.stringContaining('12%20Maple%20St'));
  });

  it('offers a big Start trip, and check in for when already there', async () => {
    const onAction = jest.fn();
    await render(<VisitCard visit={baseVisit} onAction={onAction} timeZone={NY} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Start trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));

    expect(onAction.mock.calls).toEqual([['on_the_way'], ['check_in']]);
  });

  it('offers only check out once in progress', async () => {
    await render(
      <VisitCard
        visit={{ ...baseVisit, status: 'in_progress', check_in_at: '2026-10-31T14:02:00Z' }}
        onAction={jest.fn()}
        timeZone={NY}
      />,
    );

    expect(screen.getByRole('button', { name: 'Check out' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
    expect(screen.getByText(/Checked in/)).toBeTruthy();
  });

  it('has no actions once completed', async () => {
    await render(
      <VisitCard
        visit={{ ...baseVisit, status: 'completed' }}
        onAction={jest.fn()}
        timeZone={NY}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disables actions while one is saving', async () => {
    const onAction = jest.fn();
    await render(
      <VisitCard visit={baseVisit} onAction={onAction} pendingAction="on_the_way" timeZone={NY} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('opens the visit when the card info is tapped', async () => {
    const onOpen = jest.fn();
    await render(
      <VisitCard visit={baseVisit} onAction={jest.fn()} onOpen={onOpen} timeZone={NY} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: "Open visit at Olivia's home" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('names the multi-day care time', async () => {
    await render(
      <VisitCard
        visit={{
          ...baseVisit,
          care_time: { label: 'Feed and walk' },
          booking: { ...baseVisit.booking, service_type: 'multi_day', window_start: null },
        }}
        onAction={jest.fn()}
        timeZone={NY}
      />,
    );
    expect(screen.getByText('Multi-day · Feed and walk')).toBeTruthy();
    expect(screen.getByText('3 tasks')).toBeTruthy();
  });
});

describe('arrivalWindowText', () => {
  it('describes overnight arrival and departure', () => {
    expect(
      arrivalWindowText({
        ...baseVisit.booking,
        service_type: 'overnight',
        window_start: '19:00',
        window_end: '08:00',
      }),
    ).toBe('Arrive 7:00 PM · leave 8:00 AM');
    expect(arrivalWindowText({ ...baseVisit.booking, window_end: null })).toBe('Arrive 10:00 AM');
  });
});
