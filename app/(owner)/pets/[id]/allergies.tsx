import { Stack, useLocalSearchParams } from 'expo-router';

import { AllergiesScreen } from '@/features/pets/allergies-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Allergies' }} />
      <AllergiesScreen petId={id} />
    </>
  );
}
