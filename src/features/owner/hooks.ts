import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { visitKeys } from '@/features/care/hooks';
import { supabase } from '@/lib/supabase';

import { fetchOwnerVisit, fetchOwnerVisits, fetchPetVisitHistory } from './api';

export const ownerKeys = {
  visits: ['owner-visits'] as const,
  visit: (visitId: string) => ['owner-visit', visitId] as const,
  petHistory: (petId: string) => ['owner-pet-history', petId] as const,
};

export function usePetVisitHistory(petId: string) {
  return useQuery({
    queryKey: ownerKeys.petHistory(petId),
    queryFn: () => fetchPetVisitHistory(petId),
  });
}

export function useOwnerVisits() {
  return useQuery({ queryKey: ownerKeys.visits, queryFn: () => fetchOwnerVisits(new Date()) });
}

export function useOwnerVisit(visitId: string) {
  return useQuery({ queryKey: ownerKeys.visit(visitId), queryFn: () => fetchOwnerVisit(visitId) });
}

/**
 * Refetches the owner's visit list whenever any of their visits changes. Realtime
 * applies RLS, so only the owner's own visits trigger this.
 */
export function useOwnerVisitsLiveUpdates() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('owner-visits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () =>
        queryClient.invalidateQueries({ queryKey: ownerKeys.visits }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/** Keeps one visit's status, care log, and photos live while its screen is open. */
export function useVisitLiveUpdates(visitId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const byVisit = `visit_id=eq.${visitId}`;
    const channel = supabase
      .channel(`visit-${visitId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits', filter: `id=eq.${visitId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ownerKeys.visit(visitId) });
          void queryClient.invalidateQueries({ queryKey: ownerKeys.visits });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'care_events', filter: byVisit },
        () => queryClient.invalidateQueries({ queryKey: visitKeys.careEvents(visitId) }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'media', filter: byVisit },
        () => queryClient.invalidateQueries({ queryKey: visitKeys.photos(visitId) }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents', filter: byVisit },
        () => queryClient.invalidateQueries({ queryKey: visitKeys.incidents(visitId) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [visitId, queryClient]);
}
