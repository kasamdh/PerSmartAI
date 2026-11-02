import { render, screen } from '@testing-library/react-native';

import * as hooks from '../hooks';
import { LiveBoardScreen } from '../live-board-screen';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('../hooks');

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const row = (id: string, place: string, overrides: Record<string, unknown>) => ({
  id,
  status: 'scheduled',
  scheduled_start: minutesAgo(0),
  scheduled_end: minutesAgo(-30),
  check_in_at: null,
  check_out_at: null,
  status_line: null,
  sitter: { full_name: 'Sam' },
  booking: {
    service_type: 'walk',
    household: { name: place, address_line1: '1 A St' },
    booking_pets: [],
  },
  ...overrides,
});

describe('LiveBoardScreen', () => {
  it('lists late visits first and flags them', async () => {
    jest.mocked(hooks.useTodaysVisits).mockReturnValue({
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
      data: [
        row('a', 'Lee home', {
          status: 'in_progress',
          scheduled_start: minutesAgo(40),
          check_in_at: minutesAgo(38),
          status_line: 'Out on a walk',
        }),
        row('b', 'Patel home', { scheduled_start: minutesAgo(25) }),
      ],
    } as never);

    await render(<LiveBoardScreen />);

    const cards = screen.getAllByRole('button');
    expect(cards[0].props.accessibilityLabel).toMatch(
      /^Patel home, Scheduled, Not checked in · 25 min late/,
    );
    expect(cards[1].props.accessibilityLabel).toBe('Lee home, In progress');
    expect(screen.getByLabelText('Late: 1')).toBeTruthy();
    expect(screen.getByLabelText('Under way: 1')).toBeTruthy();
    expect(screen.getByText('“Out on a walk”')).toBeTruthy();
  });
});
