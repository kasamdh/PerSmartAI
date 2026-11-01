import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-provider';
import { signedPetMediaUrl } from '@/lib/images';

import {
  deleteAllergy,
  deleteContact,
  deleteMedication,
  deletePet,
  fetchOwnHousehold,
  fetchPet,
  fetchPets,
  saveAllergy,
  saveContact,
  saveFeedingPlan,
  saveHouseholdDetails,
  saveMedication,
  savePet,
  setPrimaryContact,
} from './api';

export const petKeys = {
  all: ['pets'] as const,
  list: ['pets', 'list'] as const,
  detail: (petId: string) => ['pets', 'detail', petId] as const,
  household: (ownerId: string | undefined) => ['pets', 'household', ownerId] as const,
  photo: (path: string | null | undefined) => ['pets', 'photo', path] as const,
};

export function usePets() {
  return useQuery({ queryKey: petKeys.list, queryFn: fetchPets });
}

export function usePet(petId: string) {
  return useQuery({
    queryKey: petKeys.detail(petId),
    queryFn: () => fetchPet(petId),
    enabled: !!petId,
  });
}

export function useOwnHousehold() {
  const { session } = useAuth();
  const ownerId = session?.user.id;
  return useQuery({
    queryKey: petKeys.household(ownerId),
    queryFn: () => fetchOwnHousehold(ownerId!),
    enabled: !!ownerId,
  });
}

/** Signed URL for a private pet photo (cached; URLs last an hour). */
export function usePetPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: petKeys.photo(path),
    queryFn: () => signedPetMediaUrl(path!),
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
  });
}

/** Every pets mutation refreshes all pet data (list, details, household). */
function usePetsMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: petKeys.all }),
  });
}

export const useSavePet = () => usePetsMutation(savePet);
export const useDeletePet = () => usePetsMutation(deletePet);

export const useSaveAllergy = (petId: string) =>
  usePetsMutation(({ values, id }: { values: Parameters<typeof saveAllergy>[1]; id?: string }) =>
    saveAllergy(petId, values, id),
  );
export const useDeleteAllergy = () => usePetsMutation(deleteAllergy);

export const useSaveMedication = (petId: string) =>
  usePetsMutation(({ values, id }: { values: Parameters<typeof saveMedication>[1]; id?: string }) =>
    saveMedication(petId, values, id),
  );
export const useDeleteMedication = () => usePetsMutation(deleteMedication);

export const useSaveFeedingPlan = (petId: string) =>
  usePetsMutation(
    ({ values, id }: { values: Parameters<typeof saveFeedingPlan>[1]; id?: string }) =>
      saveFeedingPlan(petId, values, id),
  );

export const useSaveHousehold = () =>
  usePetsMutation(
    ({
      household,
      values,
    }: {
      household: Parameters<typeof saveHouseholdDetails>[0];
      values: Parameters<typeof saveHouseholdDetails>[1];
    }) => saveHouseholdDetails(household, values),
  );

export const useSaveContact = (householdId: string) =>
  usePetsMutation(({ values, id }: { values: Parameters<typeof saveContact>[1]; id?: string }) =>
    saveContact(householdId, values, id),
  );
export const useSetPrimaryContact = () => usePetsMutation(setPrimaryContact);
export const useDeleteContact = () => usePetsMutation(deleteContact);
