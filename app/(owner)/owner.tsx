import { Stack } from 'expo-router';

import { OwnerHomeScreen } from '@/features/owner/owner-home-screen';

export default function OwnerHome() {
  return (
    <>
      <Stack.Screen options={{ title: 'My pets' }} />
      <OwnerHomeScreen />
    </>
  );
}
