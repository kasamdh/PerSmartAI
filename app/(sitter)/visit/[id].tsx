import { Stack, useLocalSearchParams } from 'expo-router';

import { VisitDetailScreen } from '@/features/care/visit-detail-screen';

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Visit', headerBackTitle: 'Visits' }} />
      <VisitDetailScreen visitId={id} />
    </>
  );
}
