import { Stack, useLocalSearchParams } from 'expo-router';

import { BookingReviewScreen } from '@/features/admin/booking-review-screen';

export default function BookingReviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Booking request', headerBackTitle: 'Dashboard' }} />
      <BookingReviewScreen bookingId={id} />
    </>
  );
}
