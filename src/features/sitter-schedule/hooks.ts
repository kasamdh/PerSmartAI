import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-provider';
import { useLiveQueries } from '@/lib/realtime';

import {
  addAvailability,
  fetchAvailability,
  fetchTimeOff,
  removeAvailability,
  requestTimeOff,
  withdrawTimeOff,
} from './api';

export const sitterScheduleKeys = {
  availability: (sitterId: string | undefined) => ['sitter-availability', sitterId] as const,
  timeOff: (sitterId: string | undefined) => ['sitter-time-off', sitterId] as const,
};

function useSitterId() {
  return useAuth().session?.user.id;
}

export function useAvailability() {
  const sitterId = useSitterId();
  const key = sitterScheduleKeys.availability(sitterId);
  useLiveQueries(['sitter_availability'], [key], !!sitterId);
  return useQuery({
    queryKey: key,
    queryFn: () => fetchAvailability(sitterId!),
    enabled: !!sitterId,
  });
}

export function useTimeOff() {
  const sitterId = useSitterId();
  const key = sitterScheduleKeys.timeOff(sitterId);
  // Approvals and declines arrive live.
  useLiveQueries(['sitter_time_off'], [key], !!sitterId);
  return useQuery({
    queryKey: key,
    queryFn: () => fetchTimeOff(sitterId!, new Date()),
    enabled: !!sitterId,
  });
}

function useSitterMutation<TArgs>(
  fn: (args: TArgs & { sitterId: string }) => Promise<void>,
  key: (sitterId: string | undefined) => readonly unknown[],
) {
  const sitterId = useSitterId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => fn({ ...args, sitterId: sitterId! }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key(sitterId) }),
  });
}

export const useAddAvailability = () =>
  useSitterMutation<{ weekday: number; start_time: string; end_time: string }>(
    addAvailability,
    sitterScheduleKeys.availability,
  );

export const useRemoveAvailability = () =>
  useSitterMutation<{ id: string }>(
    ({ id }) => removeAvailability(id),
    sitterScheduleKeys.availability,
  );

export const useRequestTimeOff = () =>
  useSitterMutation<{ start_at: string; end_at: string; reason: string }>(
    requestTimeOff,
    sitterScheduleKeys.timeOff,
  );

export const useWithdrawTimeOff = () =>
  useSitterMutation<{ id: string }>(({ id }) => withdrawTimeOff(id), sitterScheduleKeys.timeOff);
