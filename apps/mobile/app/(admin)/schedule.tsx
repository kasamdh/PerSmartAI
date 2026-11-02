import { Stack } from 'expo-router';

import { ScheduleScreen } from '@/features/admin/schedule-screen';

export default function ScheduleRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Calendar' }} />
      <ScheduleScreen />
    </>
  );
}
