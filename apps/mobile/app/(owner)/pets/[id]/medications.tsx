import { Stack, useLocalSearchParams } from 'expo-router';

import { MedicationsScreen } from '@/features/pets/medications-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Medications' }} />
      <MedicationsScreen petId={id} />
    </>
  );
}
