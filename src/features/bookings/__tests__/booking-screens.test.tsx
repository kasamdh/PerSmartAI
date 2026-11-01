import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import * as petHooks from '@/features/pets/hooks';
import * as schedulingHooks from '@/features/scheduling/hooks';

import * as api from '../api';
import { BookingRequestScreen } from '../booking-request-screen';
import * as hooks from '../hooks';
import { OwnerBookingsScreen } from '../owner-bookings-screen';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('../hooks');
jest.mock('@/features/pets/hooks');
jest.mock('@/features/scheduling/hooks');
jest.mock('../api');
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
}));

const mockedHooks = jest.mocked(hooks);
const mockedPetHooks = jest.mocked(petHooks);
const mockedSchedulingHooks = jest.mocked(schedulingHooks);
const mockedApi = jest.mocked(api);
const requestMutate = jest.fn();
const cancelMutate = jest.fn();

const booking = (overrides: Record<string, unknown> = {}) => ({
  id: 'b1',
  status: 'confirmed',
  service_type: 'drop_in',
  recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE',
  start_date: '2026-11-02',
  end_date: null,
  window_start: '11:00:00',
  window_end: '13:00:00',
  duration_minutes: 30,
  notes: 'Midday break',
  created_at: '2026-10-30T00:00:00Z',
  sitter: { full_name: 'Monika' },
  booking_pets: [{ pet: { id: 'p1', name: 'Pip' } }, { pet: { id: 'p2', name: 'Mo' } }],
  schedule_change_requests: [],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedHooks.useRequestBooking.mockReturnValue({
    mutate: requestMutate,
    isPending: false,
  } as never);
  mockedHooks.useCancelBooking.mockReturnValue({ mutate: cancelMutate, isPending: false } as never);
  mockedHooks.useWithdrawScheduleChange.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
  } as never);
  mockedHooks.useOwnerCalendarVisits.mockReturnValue({ data: [], refetch: jest.fn() } as never);
  mockedSchedulingHooks.useOrgSettings.mockReturnValue({
    data: { cancellationCutoffHours: 24, timeZone: 'America/New_York' },
  } as never);
  mockedPetHooks.useOwnHousehold.mockReturnValue({
    isPending: false,
    isError: false,
    data: { id: 'h1' },
  } as never);
  mockedPetHooks.usePets.mockReturnValue({
    isPending: false,
    isError: false,
    data: [
      { id: 'p1', name: 'Pip' },
      { id: 'p2', name: 'Mo' },
    ],
  } as never);
});

describe('OwnerBookingsScreen', () => {
  const withBookings = (data: unknown[]) =>
    mockedHooks.useOwnerBookings.mockReturnValue({
      isPending: false,
      isError: false,
      isRefetching: false,
      data,
      refetch: jest.fn(),
    } as never);

  it('shows the schedule, pets, status, and sitter', async () => {
    withBookings([booking()]);
    await render(<OwnerBookingsScreen />);
    expect(screen.getByText('Drop-in · Pip, Mo')).toBeTruthy();
    expect(screen.getByText('Every Mon, Wed · 11:00 AM–1:00 PM · from Nov 2')).toBeTruthy();
    expect(screen.getByText('Confirmed · Monika')).toBeTruthy();
    expect(screen.getByText('Midday break')).toBeTruthy();
  });

  it('shows an empty state and a way to book', async () => {
    withBookings([]);
    await render(<OwnerBookingsScreen />);
    expect(screen.getByText('No bookings yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Book a visit' }));
    expect(mockPush).toHaveBeenCalledWith('/my-bookings/new');
  });

  it('confirms before cancelling and warns that visits will be cancelled', async () => {
    withBookings([booking()]);
    const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
    mockedApi.fetchUpcomingBookingVisits.mockResolvedValue([
      { id: 'v1', scheduled_start: inDays(3), scheduled_end: inDays(3.1), status: 'scheduled' },
    ]);
    const alert = jest.spyOn(Alert, 'alert');
    await render(<OwnerBookingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel booking' }));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    const [, message, buttons] = alert.mock.calls[0];
    expect(message).toBe(
      '1 upcoming visit will be cancelled; a visit already under way will still finish.',
    );
    buttons!.find((b) => b.text === 'Cancel booking')!.onPress!();
    expect(cancelMutate).toHaveBeenCalledWith('b1', expect.anything());
  });

  it('warns when the cancellation is late', async () => {
    withBookings([booking()]);
    const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
    mockedApi.fetchUpcomingBookingVisits.mockResolvedValue([
      { id: 'v1', scheduled_start: inHours(3), scheduled_end: inHours(4), status: 'scheduled' },
    ]);
    const alert = jest.spyOn(Alert, 'alert');
    await render(<OwnerBookingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel booking' }));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls[0][1]).toMatch(
      /^This is a late cancellation: a visit starts within 24 hours/,
    );
  });

  it('shows a pending reschedule request with a way to withdraw it', async () => {
    withBookings([
      booking({
        schedule_change_requests: [
          {
            id: 'r1',
            scope: 'this_and_future',
            status: 'requested',
            from_date: '2026-11-16',
            visit_id: null,
            created_at: '',
          },
        ],
      }),
    ]);
    await render(<OwnerBookingsScreen />);
    expect(
      screen.getByText('You asked to change times from Nov 16. Waiting for the business.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Withdraw request' })).toBeTruthy();
  });

  it('offers to change times for confirmed repeating bookings', async () => {
    withBookings([booking()]);
    await render(<OwnerBookingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Change times from a date' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/my-bookings/reschedule',
      params: { bookingId: 'b1' },
    });
  });

  it('offers no cancel for declined bookings', async () => {
    withBookings([booking({ status: 'declined', sitter: null })]);
    await render(<OwnerBookingsScreen />);
    expect(screen.getByText('Declined')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
  });
});

describe('BookingRequestScreen', () => {
  it('asks for a pet before sending', async () => {
    await render(<BookingRequestScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Choose at least one pet')).toBeTruthy();
    expect(requestMutate).not.toHaveBeenCalled();
  });

  it('sends a weekly walk request and goes to My bookings', async () => {
    requestMutate.mockImplementation((_args, { onSuccess }) => onSuccess('new-id'));
    await render(<BookingRequestScreen />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Which pets?: Pip' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'What do you need?: Walk' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'How often?: Some days' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'On these days: Tue' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Visit length: 45 min' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(requestMutate).toHaveBeenCalled());
    expect(requestMutate.mock.calls[0][0]).toMatchObject({
      p_service_type: 'walk',
      p_pet_ids: ['p1'],
      p_recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU',
      p_duration_minutes: 45,
      p_window_start: '09:00',
    });
    expect(mockReplace).toHaveBeenCalledWith('/my-bookings');
  });

  it('switches to evening/morning times and hides repeats for overnight stays', async () => {
    await render(<BookingRequestScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'What do you need?: Overnight' }));
    expect(screen.queryByText('How often?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sitter arrives (evening): 7:00 PM' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sitter leaves (morning): 8:00 AM' })).toBeTruthy();
    expect(screen.getByText('Back home on')).toBeTruthy();
  });

  it('shows the server’s explanation when a request is rejected', async () => {
    requestMutate.mockImplementation((_args, { onError }) =>
      onError({ code: '22023', message: 'Bookings can’t start in the past' }),
    );
    await render(<BookingRequestScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Which pets?: Mo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Bookings can’t start in the past')).toBeTruthy();
  });

  it('asks the owner to add a pet first', async () => {
    mockedPetHooks.usePets.mockReturnValue({ isPending: false, isError: false, data: [] } as never);
    await render(<BookingRequestScreen />);
    expect(screen.getByText('Add a pet first')).toBeTruthy();
  });
});
