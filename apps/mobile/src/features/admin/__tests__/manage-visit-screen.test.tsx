import { fireEvent, render, screen } from '@testing-library/react-native';

import { SchedulingError } from '@/features/scheduling/api';
import * as orgHooks from '@/features/scheduling/hooks';

import * as hooks from '../hooks';
import { ManageVisitScreen } from '../manage-visit-screen';
import * as scheduleHooks from '../schedule-hooks';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/time-zone', () => ({ deviceTimeZone: () => 'America/New_York' }));
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../hooks');
jest.mock('../schedule-hooks');
jest.mock('@/features/scheduling/hooks');

const mutate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(scheduleHooks.useScheduleVisit).mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      id: 'v1',
      booking_id: 'b1',
      sitter_id: 's1',
      status: 'scheduled',
      scheduled_start: '2026-11-10T16:00:00.000Z',
      scheduled_end: '2026-11-10T16:30:00.000Z',
      slot_start: '2026-11-10T16:00:00.000Z',
      late_cancellation: false,
      sitter: { full_name: 'Sam' },
      booking: {
        service_type: 'walk',
        household: { id: 'h1', name: 'Lee home', address_line1: '1 A St' },
        booking_pets: [{ pet: { name: 'Rex' } }],
      },
    },
  } as never);
  jest.mocked(scheduleHooks.useUpdateVisitSchedule).mockReturnValue({
    mutate,
    isPending: false,
  } as never);
  jest.mocked(orgHooks.useOrgSettings).mockReturnValue({
    isPending: false,
    isError: false,
    data: { timeZone: 'America/New_York' },
  } as never);
  jest.mocked(hooks.useSitters).mockReturnValue({
    isPending: false,
    isError: false,
    data: [
      { id: 's1', full_name: 'Sam' },
      { id: 's2', full_name: 'Ana' },
    ],
  } as never);
});

describe('ManageVisitScreen', () => {
  it('reassigns only this visit to the chosen sitter', async () => {
    await render(<ManageVisitScreen visitId="v1" />);
    expect(screen.getByRole('button', { name: 'No changes' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Ana' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Reassign visit' }));
    expect(mutate).toHaveBeenCalledWith({ visitId: 'v1', sitterId: 's2' }, expect.any(Object));
  });

  it('shows why the sitter can’t take the visit', async () => {
    mutate.mockImplementation((_args, { onError }) =>
      onError(
        new SchedulingError("The sitter can't take one visit", 409, [
          {
            local_date: '2026-11-10',
            start: '',
            end: '',
            blocking: true,
            reasons: [
              'Only 5 min after Drop-in at Patel home ends at 10:55 AM; needs 15 min travel time',
            ],
          },
        ]),
      ),
    );
    await render(<ManageVisitScreen visitId="v1" />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Ana' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Reassign visit' }));

    expect(screen.getByText('Can’t save this')).toBeTruthy();
    expect(
      screen.getByText(
        '• Only 5 min after Drop-in at Patel home ends at 10:55 AM; needs 15 min travel time',
      ),
    ).toBeTruthy();
  });
});
