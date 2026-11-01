import { Stack } from 'expo-router';

import { BusinessSettingsScreen } from '@/features/admin/business-settings-screen';

export default function BusinessSettingsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Scheduling settings' }} />
      <BusinessSettingsScreen />
    </>
  );
}
