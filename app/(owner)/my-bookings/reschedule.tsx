import { Stack, useLocalSearchParams } from 'expo-router';

import { RescheduleScreen } from '@/features/bookings/reschedule-screen';

export default function RescheduleRoute() {
  const { bookingId, visitId } = useLocalSearchParams<{ bookingId: string; visitId?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: visitId ? 'Move a visit' : 'Change times' }} />
      <RescheduleScreen bookingId={bookingId} visitId={visitId} />
    </>
  );
}
