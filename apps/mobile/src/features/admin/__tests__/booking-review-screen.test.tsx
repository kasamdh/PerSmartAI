import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { BookingReviewScreen } from '../booking-review-screen';
import * as hooks from '../hooks';
import * as scheduleHooks from '../schedule-hooks';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('../hooks');
jest.mock('../schedule-hooks');

const mockedHooks = jest.mocked(hooks);
const mockedScheduleHooks = jest.mocked(scheduleHooks);
const confirmMutate = jest.fn();
const declineMutate = jest.fn();

const booking = {
  id: 'b3',
  status: 'requested',
  service_type: 'overnight',
  recurrence_rule: null,
  start_date: '2026-11-20',
  end_date: '2026-11-22',
  window_start: null,
  window_end: null,
  duration_minutes: null,
  notes: 'Away for a wedding.',
  created_at: '2026-10-30T00:00:00Z',
  sitter_id: null,
  household: {
    name: "Oscar's apartment",
    address_line1: '450 Pine Ave',
    city: 'Brooklyn',
    owner: { full_name: 'Oscar Owner', phone: '+15555550202' },
  },
  booking_pets: [{ pet: { id: 'p3', name: 'Rex', species: 'dog' } }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedHooks.useBooking.mockReturnValue({
    isPending: false,
    isError: false,
    data: booking,
  } as never);
  mockedHooks.useSitters.mockReturnValue({
    isPending: false,
    isError: false,
    data: [
      { id: 's1', full_name: 'Monika', phone: null },
      { id: 's2', full_name: 'Sky Sitter', phone: null },
    ],
  } as never);
  mockedHooks.useConfirmBooking.mockReturnValue({
    mutate: confirmMutate,
    isPending: false,
  } as never);
  mockedHooks.useDeclineBooking.mockReturnValue({
    mutate: declineMutate,
    isPending: false,
  } as never);
  mockedScheduleHooks.useSitterChecks.mockReturnValue({
    isError: false,
    data: [
      {
        sitter_id: 's1',
        ok: false,
        blocking: 1,
        problems: [
          {
            local_date: '2026-11-20',
            start: '',
            end: '',
            blocking: true,
            reasons: ['Time off Fri, Nov 20, 12:00 AM – Sun, Nov 22, 12:00 AM'],
          },
        ],
      },
      { sitter_id: 's2', ok: true, blocking: 0, problems: [] },
    ],
  } as never);
});

describe('BookingReviewScreen', () => {
  it('shows the request details for the admin', async () => {
    await render(<BookingReviewScreen bookingId="b3" />);

    expect(screen.getByText("Overnight · Oscar's apartment")).toBeTruthy();
    expect(screen.getByText('Overnight · Nov 20 → Nov 22')).toBeTruthy();
    expect(screen.getByText('Pets: Rex (dog)')).toBeTruthy();
    expect(screen.getByText('“Away for a wedding.”')).toBeTruthy();
  });

  it('requires picking a sitter before confirming', async () => {
    await render(<BookingReviewScreen bookingId="b3" />);

    await fireEvent.press(screen.getByRole('button', { name: 'Pick a sitter to confirm' }));
    expect(confirmMutate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: 'Sky Sitter. Free for every visit' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm with Sky' }));
    expect(confirmMutate).toHaveBeenCalledWith(
      { bookingId: 'b3', sitterId: 's2' },
      expect.any(Object),
    );
  });

  it('shows which sitters are free, and why the others are not', async () => {
    await render(<BookingReviewScreen bookingId="b3" />);

    const options = screen.getAllByRole('radio');
    expect(options.map((o) => o.props.accessibilityLabel)).toEqual([
      'Sky Sitter. Free for every visit',
      'Monika. Can’t take 1 visit: Time off Fri, Nov 20, 12:00 AM – Sun, Nov 22, 12:00 AM',
    ]);
    expect(mockedScheduleHooks.useSitterChecks).toHaveBeenCalledWith('b3', ['s1', 's2']);
  });

  it('asks before declining', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<BookingReviewScreen bookingId="b3" />);

    await fireEvent.press(screen.getByRole('button', { name: 'Decline request' }));
    expect(alert).toHaveBeenCalledWith(
      'Decline this request?',
      expect.any(String),
      expect.any(Array),
    );
    expect(declineMutate).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Decline')?.onPress?.();
    expect(declineMutate).toHaveBeenCalledWith('b3', expect.any(Object));
  });

  it('hides the actions once a booking has been handled', async () => {
    mockedHooks.useBooking.mockReturnValue({
      isPending: false,
      isError: false,
      data: { ...booking, status: 'confirmed' },
    } as never);
    await render(<BookingReviewScreen bookingId="b3" />);

    expect(screen.getByText('This booking is confirmed.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Confirm/ })).toBeNull();
  });
});
