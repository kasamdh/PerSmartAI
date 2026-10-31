import { Stack } from 'expo-router';

import { HouseholdScreen } from '@/features/pets/household-screen';

export default function HouseholdRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Home & contacts' }} />
      <HouseholdScreen />
    </>
  );
}
