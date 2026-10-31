import { useRouter } from 'expo-router';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { EmptyView, ErrorView, LoadingView } from '@/components/query-states';

import type { OwnerBooking } from './api';
import { describeSchedule } from './booking-text';
import { useCancelBooking, useOwnerBookings } from './hooks';
import { bookingStatus, canOwnerCancel } from './status';

const SERVICE_LABEL: Record<OwnerBooking['service_type'], string> = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight stay',
  multi_day: 'Multi-day care',
};

export function OwnerBookingsScreen() {
  const router = useRouter();
  const bookings = useOwnerBookings();

  if (bookings.isPending) return <LoadingView label="Loading bookings" />;
  if (bookings.isError) return <ErrorView onRetry={() => bookings.refetch()} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={bookings.isRefetching}
            onRefresh={() => void bookings.refetch()}
          />
        }
      >
        <BigButton label="Book a visit" onPress={() => router.push('/my-bookings/new')} />
        {bookings.data.length === 0 ? (
          <EmptyView
            title="No bookings yet"
            body="Book drop-ins, walks, or overnight stays and we’ll confirm a sitter."
          />
        ) : (
          bookings.data.map((b) => <OwnerBookingCard key={b.id} booking={b} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function OwnerBookingCard({ booking }: { booking: OwnerBooking }) {
  const cancel = useCancelBooking();
  const status = bookingStatus(booking.status);
  const pets = booking.booking_pets
    .map((bp) => bp.pet?.name)
    .filter(Boolean)
    .join(', ');
  const title = `${SERVICE_LABEL[booking.service_type]}${pets ? ` · ${pets}` : ''}`;

  const confirmCancel = () =>
    Alert.alert(
      'Cancel this booking?',
      booking.status === 'confirmed'
        ? 'Upcoming visits will be cancelled. A visit already under way will still finish.'
        : 'Your request will be withdrawn.',
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: () =>
            cancel.mutate(booking.id, {
              onError: (error) =>
                Alert.alert(
                  'Couldn’t cancel',
                  error instanceof Error && !('code' in error)
                    ? error.message
                    : 'Please try again.',
                ),
            }),
        },
      ],
    );

  return (
    <View style={styles.card} accessible={false}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.schedule}>{describeSchedule(booking)}</Text>
      <Text style={[styles.status, styles[status.tone]]}>
        {status.label}
        {booking.status === 'confirmed' && booking.sitter ? ` · ${booking.sitter.full_name}` : ''}
      </Text>
      {booking.notes ? <Text style={styles.notes}>{booking.notes}</Text> : null}
      {canOwnerCancel(booking.status) ? (
        <BigButton
          label="Cancel booking"
          variant="secondary"
          onPress={confirmCancel}
          loading={cancel.isPending}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 6 },
  title: { fontSize: 19, fontWeight: '700', color: '#1A1A1A' },
  schedule: { fontSize: 17, color: '#333333' },
  status: { fontSize: 16, fontWeight: '600' },
  waiting: { color: '#9A6700' },
  good: { color: '#1B7F3B' },
  bad: { color: '#C62828' },
  muted: { color: '#666666' },
  notes: { fontSize: 15, color: '#555555', marginBottom: 4 },
});
