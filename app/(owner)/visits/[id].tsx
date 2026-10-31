import { Stack, useLocalSearchParams } from 'expo-router';

import { OwnerVisitScreen } from '@/features/owner/owner-visit-screen';

export default function OwnerVisitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Visit', headerBackTitle: 'My pets' }} />
      <OwnerVisitScreen visitId={id} />
    </>
  );
}
