import { Stack } from 'expo-router';

import { BookingRequestScreen } from '@/features/bookings/booking-request-screen';

export default function NewBookingRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Book a visit' }} />
      <BookingRequestScreen />
    </>
  );
}
