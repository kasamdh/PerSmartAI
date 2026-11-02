import { Stack } from 'expo-router';

import { PetFormScreen } from '@/features/pets/pet-form-screen';

export default function NewPetRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Add a pet' }} />
      <PetFormScreen />
    </>
  );
}
