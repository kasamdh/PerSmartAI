import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { getCurrentCoords } from '@/lib/location';
import { useLiveQueries } from '@/lib/realtime';

import { fetchSitterVisits, updateVisit } from './api';
import { addLocalDays, startOfLocalDay } from './time';
import { buildVisitUpdate, type VisitActionKind } from './visit-actions';

const SITTER_VISITS_KEY = 'sitter-visits';

/**
 * The sitter's visits overlapping `range` (default: today), live: Realtime refetches
 * when a visit or booking changes, so reassignments and cancellations appear at once.
 */
export function useSitterVisits(range?: { from: Date; to: Date }) {
  const { session } = useAuth();
  const sitterId = session?.user.id;
  // Recompute the default range only when the local day changes.
  const dayStart = startOfLocalDay(new Date()).getTime();
  const today = useMemo(
    () => ({ from: new Date(dayStart), to: addLocalDays(new Date(dayStart), 1) }),
    [dayStart],
  );
  const { from, to } = range ?? today;
  useLiveQueries(['visits', 'bookings'], [[SITTER_VISITS_KEY]], !!sitterId);

  return useQuery({
    queryKey: [SITTER_VISITS_KEY, sitterId, from.toISOString(), to.toISOString()],
    queryFn: () => fetchSitterVisits(sitterId!, { from, to }),
    enabled: !!sitterId,
  });
}

export function useVisitAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      visitId,
      action,
      summary,
    }: {
      visitId: string;
      action: VisitActionKind;
      summary?: string;
    }) => {
      const coords = action === 'on_the_way' ? null : await getCurrentCoords();
      await updateVisit(visitId, buildVisitUpdate(action, new Date(), coords, summary));
    },
    onSettled: (_data, _error, { visitId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [SITTER_VISITS_KEY] }),
        queryClient.invalidateQueries({ queryKey: ['visit', visitId] }),
      ]),
  });
}

/**
 * Runs visit actions with the shared UX: check-out opens a sheet that confirms
 * and collects a summary for the owner; failures show an alert. Render
 * `<CheckOutSheet {...checkOutSheet} />` on the screen. `pendingFor` drives spinners.
 */
export function useVisitActionRunner() {
  const visitAction = useVisitAction();
  const [checkingOut, setCheckingOut] = useState<{ id: string; placeName: string } | null>(null);

  const pendingFor = (visitId: string): VisitActionKind | null =>
    visitAction.isPending && visitAction.variables?.visitId === visitId
      ? visitAction.variables.action
      : null;

  const execute = (visitId: string, action: VisitActionKind, summary?: string) =>
    visitAction.mutate(
      { visitId, action, summary },
      {
        onError: (error) =>
          Alert.alert("Couldn't update the visit", error.message || 'Please try again.'),
      },
    );

  const run = (visit: { id: string; placeName: string }, action: VisitActionKind) => {
    if (action === 'check_out') {
      setCheckingOut(visit);
    } else {
      execute(visit.id, action);
    }
  };

  const checkOutSheet = {
    placeName: checkingOut?.placeName ?? null,
    onCancel: () => setCheckingOut(null),
    onConfirm: (summary: string) => {
      if (checkingOut) {
        execute(checkingOut.id, 'check_out', summary);
      }
      setCheckingOut(null);
    },
  };

  return { run, pendingFor, checkOutSheet };
}
