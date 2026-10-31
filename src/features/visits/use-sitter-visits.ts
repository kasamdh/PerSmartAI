import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert } from 'react-native';

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
    onSettled: (_data, _error, { visitId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [SITTER_VISITS_KEY] }),
        queryClient.invalidateQueries({ queryKey: ['visit', visitId] }),
      ]),
  });
}

/**
 * Runs visit actions with the shared UX: check-out asks for confirmation (it ends
 * the visit for the owner), failures show an alert. `pendingFor` drives spinners.
 */
export function useVisitActionRunner() {
  const visitAction = useVisitAction();

  const pendingFor = (visitId: string): VisitActionKind | null =>
    visitAction.isPending && visitAction.variables?.visitId === visitId
      ? visitAction.variables.action
      : null;

  const execute = (visitId: string, action: VisitActionKind) =>
    visitAction.mutate(
      { visitId, action },
      {
        onError: (error) =>
          Alert.alert("Couldn't update the visit", error.message || 'Please try again.'),
      },
    );

  const run = (visit: { id: string; placeName: string }, action: VisitActionKind) => {
    if (action !== 'check_out') {
      execute(visit.id, action);
      return;
    }
    Alert.alert('Check out?', `Finish the visit at ${visit.placeName}?`, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Check out', onPress: () => execute(visit.id, action) },
    ]);
  };

  return { run, pendingFor };
}
