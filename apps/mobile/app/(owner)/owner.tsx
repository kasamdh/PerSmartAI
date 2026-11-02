import { Stack } from 'expo-router';

import { OwnerHomeScreen } from '@/features/owner/owner-home-screen';

export default function OwnerHome() {
  return (
    <>
      {/* The home draws its own greeting header. */}
      <Stack.Screen options={{ title: 'Home', headerShown: false }} />
      <OwnerHomeScreen />
    </>
  );
}
