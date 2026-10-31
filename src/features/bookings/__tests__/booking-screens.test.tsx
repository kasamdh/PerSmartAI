import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import * as petHooks from '@/features/pets/hooks';

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

const mockedHooks = jest.mocked(hooks);
const mockedPetHooks = jest.mocked(petHooks);
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
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedHooks.useRequestBooking.mockReturnValue({
    mutate: requestMutate,
    isPending: false,
  } as never);
  mockedHooks.useCancelBooking.mockReturnValue({ mutate: cancelMutate, isPending: false } as never);
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
    const alert = jest.spyOn(Alert, 'alert');
    await render(<OwnerBookingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel booking' }));

    const [, message, buttons] = alert.mock.calls[0];
    expect(message).toMatch(/Upcoming visits will be cancelled/);
    buttons!.find((b) => b.text === 'Cancel booking')!.onPress!();
    expect(cancelMutate).toHaveBeenCalledWith('b1', expect.anything());
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
    expect(screen.getByDisplayValue('19:00')).toBeTruthy();
    expect(screen.getByDisplayValue('08:00')).toBeTruthy();
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
