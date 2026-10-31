import { Stack, useLocalSearchParams } from 'expo-router';

import { PetDetailScreen } from '@/features/pets/pet-detail-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Pet' }} />
      <PetDetailScreen petId={id} editable />
    </>
  );
}
