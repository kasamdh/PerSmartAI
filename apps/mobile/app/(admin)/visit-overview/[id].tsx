import { Stack, useLocalSearchParams } from 'expo-router';

import { OwnerVisitScreen } from '@/features/owner/owner-visit-screen';

// Admins get the same live, read-only visit view as owners (RLS allows any visit in the org).
export default function AdminVisitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Visit', headerBackTitle: 'Dashboard' }} />
      <OwnerVisitScreen visitId={id} />
    </>
  );
}
