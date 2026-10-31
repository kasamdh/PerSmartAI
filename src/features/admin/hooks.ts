import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  confirmBooking,
  declineBooking,
  fetchBooking,
  fetchBookingRequests,
  fetchSitters,
  fetchTodaysVisits,
} from './api';

export const adminKeys = {
  requests: ['admin', 'booking-requests'] as const,
  booking: (id: string) => ['admin', 'booking', id] as const,
  today: ['admin', 'today'] as const,
  sitters: ['admin', 'sitters'] as const,
};

export function useBookingRequests() {
  return useQuery({ queryKey: adminKeys.requests, queryFn: fetchBookingRequests });
}

export function useBooking(bookingId: string) {
  return useQuery({
    queryKey: adminKeys.booking(bookingId),
    queryFn: () => fetchBooking(bookingId),
  });
}

export function useTodaysVisits() {
  return useQuery({ queryKey: adminKeys.today, queryFn: () => fetchTodaysVisits(new Date()) });
}

export function useSitters() {
  return useQuery({ queryKey: adminKeys.sitters, queryFn: fetchSitters, staleTime: 5 * 60_000 });
}

function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['admin'] });
}

export function useConfirmBooking() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ bookingId, sitterId }: { bookingId: string; sitterId: string }) =>
      confirmBooking(bookingId, sitterId),
    onSettled: invalidate,
  });
}

export function useDeclineBooking() {
  const invalidate = useInvalidateAdmin();
  return useMutation({ mutationFn: declineBooking, onSettled: invalidate });
}
