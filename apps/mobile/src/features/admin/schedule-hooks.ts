import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { orgKeys } from '@/features/scheduling/hooks';
import { useLiveQueries } from '@/lib/realtime';

import {
  checkSitters,
  decideChangeRequest,
  decideTimeOff,
  fetchChangeRequests,
  fetchScheduleVisit,
  fetchScheduleVisits,
  fetchTimeOffRequests,
  saveOrgSettings,
  updateVisitSchedule,
} from './schedule-api';

export const scheduleKeys = {
  all: ['admin', 'schedule'] as const,
  visits: (from: string, to: string) => ['admin', 'schedule', 'visits', from, to] as const,
  visit: (id: string) => ['admin', 'schedule', 'visit', id] as const,
  changeRequests: ['admin', 'schedule', 'change-requests'] as const,
  timeOff: ['admin', 'schedule', 'time-off'] as const,
  sitterChecks: (bookingId: string) => ['admin', 'schedule', 'sitter-checks', bookingId] as const,
};

/** All visits in a range, live as sitters check in or admins reassign. */
export function useScheduleVisits(range: { from: Date; to: Date }) {
  useLiveQueries(['visits', 'bookings'], [scheduleKeys.all]);
  return useQuery({
    queryKey: scheduleKeys.visits(range.from.toISOString(), range.to.toISOString()),
    queryFn: () => fetchScheduleVisits(range),
  });
}

export function useScheduleVisit(visitId: string) {
  useLiveQueries(['visits'], [scheduleKeys.visit(visitId)]);
  return useQuery({
    queryKey: scheduleKeys.visit(visitId),
    queryFn: () => fetchScheduleVisit(visitId),
  });
}

export function useChangeRequests() {
  useLiveQueries(['schedule_change_requests'], [scheduleKeys.changeRequests]);
  return useQuery({ queryKey: scheduleKeys.changeRequests, queryFn: fetchChangeRequests });
}

export function useTimeOffRequests() {
  useLiveQueries(['sitter_time_off'], [scheduleKeys.timeOff]);
  return useQuery({
    queryKey: scheduleKeys.timeOff,
    queryFn: () => fetchTimeOffRequests(new Date()),
  });
}

/** Which sitters can take every visit of this booking (no writes). */
export function useSitterChecks(bookingId: string, sitterIds: string[] | undefined) {
  return useQuery({
    queryKey: [...scheduleKeys.sitterChecks(bookingId), sitterIds],
    queryFn: () => checkSitters(bookingId, sitterIds!),
    enabled: !!sitterIds && sitterIds.length > 0,
    staleTime: 30_000,
  });
}

function useAdminMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export const useDecideTimeOff = () => useAdminMutation(decideTimeOff);
export const useDecideChangeRequest = () => useAdminMutation(decideChangeRequest);
export const useUpdateVisitSchedule = () => useAdminMutation(updateVisitSchedule);

export function useSaveOrgSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveOrgSettings,
    onSettled: () => queryClient.invalidateQueries({ queryKey: orgKeys.settings }),
  });
}
