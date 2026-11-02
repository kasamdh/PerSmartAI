import { Stack, useLocalSearchParams } from 'expo-router';

import { ManageVisitScreen } from '@/features/admin/manage-visit-screen';

export default function ManageVisitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Visit' }} />
      <ManageVisitScreen visitId={id} />
    </>
  );
}
