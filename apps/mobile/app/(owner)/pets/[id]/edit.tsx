import { Stack, useLocalSearchParams } from 'expo-router';

import { PetFormScreen } from '@/features/pets/pet-form-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Edit pet' }} />
      <PetFormScreen petId={id} />
    </>
  );
}
