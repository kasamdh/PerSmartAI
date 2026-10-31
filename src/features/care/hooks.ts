import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteCareEvent,
  fetchCareEvents,
  fetchVisitDetail,
  fetchVisitPhotos,
  logCareEvent,
  uploadVisitPhoto,
} from './api';

export const visitKeys = {
  detail: (visitId: string) => ['visit', visitId] as const,
  careEvents: (visitId: string) => ['care-events', visitId] as const,
  photos: (visitId: string) => ['visit-photos', visitId] as const,
};

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
