import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useLiveQueries } from '@/lib/realtime';

import {
  deleteCareEvent,
  fetchCareEvents,
  fetchIncidents,
  reportIncident,
  updateCareEvent,
  fetchVisitDetail,
  fetchVisitPhotos,
  logCareEvent,
  uploadVisitPhoto,
} from './api';

export const visitKeys = {
  detail: (visitId: string) => ['visit', visitId] as const,
  careEvents: (visitId: string) => ['care-events', visitId] as const,
  photos: (visitId: string) => ['visit-photos', visitId] as const,
  incidents: (visitId: string) => ['visit-incidents', visitId] as const,
};

/** Keeps the sitter's visit screen in sync with changes from other devices or admins. */
export function useSitterVisitLiveUpdates(visitId: string) {
  useLiveQueries(
    ['visits', 'care_events', 'incidents'],
    [visitKeys.detail(visitId), visitKeys.careEvents(visitId), visitKeys.incidents(visitId)],
  );
}

export function useIncidents(visitId: string) {
  return useQuery({
    queryKey: visitKeys.incidents(visitId),
    queryFn: () => fetchIncidents(visitId),
  });
}

export function useReportIncident(visitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof reportIncident>[0], 'visitId'>) =>
      reportIncident({ ...input, visitId }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: visitKeys.incidents(visitId) }),
        queryClient.invalidateQueries({ queryKey: visitKeys.photos(visitId) }),
      ]),
  });
}

export function useUpdateCareEvent(visitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: Parameters<typeof updateCareEvent>[1] }) =>
      updateCareEvent(id, value),
    onSettled: () => queryClient.invalidateQueries({ queryKey: visitKeys.careEvents(visitId) }),
  });
}

export function useVisitDetail(visitId: string) {
  return useQuery({
    queryKey: visitKeys.detail(visitId),
    queryFn: () => fetchVisitDetail(visitId),
  });
}

export function useCareEvents(visitId: string) {
  return useQuery({
    queryKey: visitKeys.careEvents(visitId),
    queryFn: () => fetchCareEvents(visitId),
  });
}

export function useVisitPhotos(visitId: string) {
  return useQuery({
    queryKey: visitKeys.photos(visitId),
    queryFn: () => fetchVisitPhotos(visitId),
    staleTime: 10 * 60 * 1000, // signed URLs last an hour
  });
}

export function useLogCareEvent(visitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof logCareEvent>[0], 'visitId'>) =>
      logCareEvent({ ...input, visitId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: visitKeys.careEvents(visitId) }),
  });
}

export function useDeleteCareEvent(visitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCareEvent,
    onSettled: () => queryClient.invalidateQueries({ queryKey: visitKeys.careEvents(visitId) }),
  });
}

export function useUploadVisitPhoto(visitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof uploadVisitPhoto>[0], 'visitId'>) =>
      uploadVisitPhoto({ ...input, visitId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: visitKeys.photos(visitId) }),
  });
}
