import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ownerKeys } from '@/features/owner/hooks';
import { toDateString } from '@/lib/wall-clock';

import { useLiveQueries } from '@/lib/realtime';

import {
  cancelBooking,
  fetchOwnerBookings,
  fetchOwnerCalendarVisits,
  requestBooking,
  requestScheduleChange,
  withdrawScheduleChange,
} from './api';

export const bookingKeys = {
  all: ['bookings'] as const,
  owner: (today: string) => ['bookings', 'owner', today] as const,
  calendar: (from: string, to: string) => ['bookings', 'calendar', from, to] as const,
};

/** The owner's bookings, live: confirmations, declines and reschedules appear at once. */
export function useOwnerBookings() {
  const today = toDateString(new Date());
  useLiveQueries(['bookings', 'schedule_change_requests'], [bookingKeys.all]);
  return useQuery({ queryKey: bookingKeys.owner(today), queryFn: () => fetchOwnerBookings(today) });
}

/** The owner's visits in a date range (device-local days), live. */
export function useOwnerCalendarVisits(range: { from: Date; to: Date }) {
  useLiveQueries(['visits'], [bookingKeys.all]);
  return useQuery({
    queryKey: bookingKeys.calendar(range.from.toISOString(), range.to.toISOString()),
    queryFn: () => fetchOwnerCalendarVisits(range),
  });
}

/** Booking changes can add or cancel visits, so refresh those too. */
function useBookingsMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.visits });
    },
  });
}

export const useRequestBooking = () => useBookingsMutation(requestBooking);
export const useCancelBooking = () => useBookingsMutation(cancelBooking);
export const useRequestScheduleChange = () => useBookingsMutation(requestScheduleChange);
export const useWithdrawScheduleChange = () => useBookingsMutation(withdrawScheduleChange);
