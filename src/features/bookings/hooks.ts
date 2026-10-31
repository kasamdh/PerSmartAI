import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ownerKeys } from '@/features/owner/hooks';

import { cancelBooking, fetchOwnerBookings, requestBooking } from './api';
import { toDateString } from './schemas';

export const bookingKeys = {
  all: ['bookings'] as const,
  owner: (today: string) => ['bookings', 'owner', today] as const,
};

export function useOwnerBookings() {
  const today = toDateString(new Date());
  return useQuery({ queryKey: bookingKeys.owner(today), queryFn: () => fetchOwnerBookings(today) });
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
