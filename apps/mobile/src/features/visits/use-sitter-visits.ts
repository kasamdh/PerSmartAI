import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { checkInDistanceWarning } from '@/lib/geo';
import { getCurrentCoords, type Coords } from '@/lib/location';
import { useLiveQueries } from '@/lib/realtime';

import { advanceVisit, fetchSitterVisits } from './api';
import { addLocalDays, startOfLocalDay } from './time';
import type { VisitActionKind } from './visit-actions';
import { advanceArgs } from './visit-status';

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
    mutationFn: ({
      visitId,
      action,
      coords,
      summary,
    }: {
      visitId: string;
      action: VisitActionKind;
      coords: Coords | null;
      summary?: string;
    }) => advanceVisit(advanceArgs(visitId, action, coords, summary)),
    onSettled: (_data, _error, { visitId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [SITTER_VISITS_KEY] }),
        queryClient.invalidateQueries({ queryKey: ['visit', visitId] }),
      ]),
  });
}

export type RunnableVisit = {
  id: string;
  placeName: string;
  /** For the check-in distance warning. */
  home: { lat: number | null; lng: number | null; address: string };
};

/**
 * Runs visit actions with the shared UX. Check-in reads the location (foreground
 * only) and warns, without blocking, when it's more than 200 m from the household.
 * Check-out is handed to `onCheckOut` (the visit screen checks medication tasks and
 * collects the summary first), then finished with `checkOut`.
 */
export function useVisitActionRunner({
  onCheckOut,
}: { onCheckOut?: (visit: RunnableVisit) => void } = {}) {
  const visitAction = useVisitAction();
  const [locating, setLocating] = useState<string | null>(null);

  const pendingFor = (visitId: string): VisitActionKind | null =>
    locating === visitId
      ? 'check_in'
      : visitAction.isPending && visitAction.variables?.visitId === visitId
        ? visitAction.variables.action
        : null;

  const execute = (
    visitId: string,
    action: VisitActionKind,
    coords: Coords | null,
    summary?: string,
    onDone?: () => void,
  ) =>
    visitAction.mutate(
      { visitId, action, coords, summary },
      {
        onSuccess: onDone,
        onError: (error) =>
          Alert.alert("Couldn't update the visit", error.message || 'Please try again.'),
      },
    );

  const run = async (visit: RunnableVisit, action: VisitActionKind) => {
    if (action === 'check_out') {
      onCheckOut?.(visit);
      return;
    }
    if (action === 'on_the_way') {
      execute(visit.id, action, null);
      return;
    }
    setLocating(visit.id);
    const coords = await getCurrentCoords();
    setLocating(null);
    const warning = checkInDistanceWarning(coords, visit.home);
    if (!warning) {
      execute(visit.id, 'check_in', coords);
      return;
    }
    Alert.alert('Check in here?', `${warning.message} Check in anyway?`, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Check in', onPress: () => execute(visit.id, 'check_in', coords) },
    ]);
  };

  const checkOut = async (visitId: string, summary: string, onDone?: () => void) => {
    const coords = await getCurrentCoords();
    execute(visitId, 'check_out', coords, summary, onDone);
  };

  return { run, pendingFor, checkOut };
}
