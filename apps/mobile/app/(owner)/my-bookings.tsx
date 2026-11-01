import { Stack } from 'expo-router';

import { OwnerBookingsScreen } from '@/features/bookings/owner-bookings-screen';

export default function OwnerBookingsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'My bookings' }} />
      <OwnerBookingsScreen />
    </>
  );
}
