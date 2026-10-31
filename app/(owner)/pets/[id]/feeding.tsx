import { Stack, useLocalSearchParams } from 'expo-router';

import { FeedingScreen } from '@/features/pets/feeding-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Feeding' }} />
      <FeedingScreen petId={id} />
    </>
  );
}
