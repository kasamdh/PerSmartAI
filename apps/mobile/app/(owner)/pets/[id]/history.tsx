import { Stack, useLocalSearchParams } from 'expo-router';

import { PetHistoryScreen } from '@/features/owner/pet-history-screen';
import { usePet } from '@/features/pets/hooks';

export default function PetHistoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const name = usePet(id).data?.name ?? 'Your pet';
  return (
    <>
      <Stack.Screen options={{ title: `${name}'s visits` }} />
      <PetHistoryScreen petId={id} petName={name} />
    </>
  );
}
