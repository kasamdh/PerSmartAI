import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import { getCurrentCoords } from '@/lib/location';

import { fetchSitterVisits, updateVisit } from './api';
import { sitterScheduleRange, startOfLocalDay } from './time';
import { buildVisitUpdate, type VisitActionKind } from './visit-actions';

const SITTER_VISITS_KEY = 'sitter-visits';

export function useSitterVisits() {
  const { session } = useAuth();
  const sitterId = session?.user.id;
  // Recompute the range only when the local day changes.
  const dayStart = startOfLocalDay(new Date()).getTime();
  const range = useMemo(() => sitterScheduleRange(new Date(dayStart)), [dayStart]);

  return useQuery({
    queryKey: [SITTER_VISITS_KEY, sitterId, range.from.toISOString()],
    queryFn: () => fetchSitterVisits(sitterId!, range),
    enabled: !!sitterId,
  });
}

export function useVisitAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ visitId, action }: { visitId: string; action: VisitActionKind }) => {
      const coords = action === 'on_the_way' ? null : await getCurrentCoords();
      await updateVisit(visitId, buildVisitUpdate(action, new Date(), coords));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [SITTER_VISITS_KEY] }),
  });
}
