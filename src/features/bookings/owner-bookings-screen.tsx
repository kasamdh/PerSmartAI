import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { EmptyView, ErrorView, LoadingView } from '@/components/query-states';
import { cancellationPreview } from '@/features/scheduling';
import { groupByLocalDate, localDayRange, monthGrid } from '@/features/scheduling/calendar';
import { MonthCalendar } from '@/features/scheduling/components/month-calendar';
import { useOrgSettings } from '@/features/scheduling/hooks';
import { formatTimeRange } from '@/features/visits/time';
import { statusLabel } from '@/features/visits/visit-actions';
import { toDateString } from '@/lib/wall-clock';

import { fetchUpcomingBookingVisits, type OwnerBooking, type OwnerCalendarVisit } from './api';
import { describeSchedule, formatCalendarDate } from './booking-text';
import {
  useCancelBooking,
  useOwnerBookings,
  useOwnerCalendarVisits,
  useWithdrawScheduleChange,
} from './hooks';
import { cancelMessage } from './reschedule';
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
  const today = toDateString(new Date());
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));
  const range = useMemo(() => {
    const weeks = monthGrid(month.year, month.month);
    return localDayRange(weeks[0][0].date, weeks.at(-1)!.at(-1)!.date);
  }, [month]);
  const visits = useOwnerCalendarVisits(range);
  const byDay = useMemo(() => groupByLocalDate(visits.data ?? []), [visits.data]);
  const counts = useMemo(
    () =>
      new Map(
        [...byDay].map(([date, list]) => [
          date,
          list.filter((v) => v.status !== 'cancelled').length,
        ]),
      ),
    [byDay],
  );

  if (bookings.isPending) return <LoadingView label="Loading bookings" />;
  if (bookings.isError) return <ErrorView onRetry={() => bookings.refetch()} />;

  const changeMonth = (delta: -1 | 1) =>
    setMonth(({ year, month: m }) => {
      const next = m + delta;
      return next < 1
        ? { year: year - 1, month: 12 }
        : next > 12
          ? { year: year + 1, month: 1 }
          : { year, month: next };
    });

  const dayVisits = byDay.get(selected) ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={bookings.isRefetching}
            onRefresh={() => {
              void bookings.refetch();
              void visits.refetch?.();
            }}
          />
        }
      >
        {bookings.data.length === 0 ? (
          <EmptyView
            title="No bookings yet"
            body="Book drop-ins, walks, overnight or multi-day care and we’ll confirm a sitter."
          />
        ) : (
          <>
            <MonthCalendar
              year={month.year}
              month={month.month}
              selected={selected}
              today={today}
              counts={counts}
              onSelect={setSelected}
              onChangeMonth={changeMonth}
            />
            <Text style={styles.heading} accessibilityRole="header">
              {selected === today ? 'Today' : formatCalendarDate(selected)}
            </Text>
            {dayVisits.length === 0 ? (
              <Text style={styles.muted}>No visits this day.</Text>
            ) : (
              dayVisits.map((v) => (
                <DayVisit
                  key={v.id}
                  visit={v}
                  onReschedule={() =>
                    router.push({
                      pathname: '/my-bookings/reschedule',
                      params: { bookingId: v.booking_id, visitId: v.id },
                    })
                  }
                />
              ))
            )}

            <Text style={styles.heading} accessibilityRole="header">
              Bookings
            </Text>
            {bookings.data.map((b) => (
              <OwnerBookingCard key={b.id} booking={b} />
            ))}
          </>
        )}
        <BigButton label="Book a visit" onPress={() => router.push('/my-bookings/new')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DayVisit({
  visit,
  onReschedule,
}: {
  visit: OwnerCalendarVisit;
  onReschedule: () => void;
}) {
  const cancelled = visit.status === 'cancelled';
  const pets = visit.booking.booking_pets
    .map((bp) => bp.pet?.name)
    .filter(Boolean)
    .join(', ');
  const canMove =
    visit.status === 'scheduled' &&
    visit.booking.status === 'confirmed' &&
    new Date(visit.scheduled_start) > new Date();
  return (
    <View style={styles.visit}>
      <Text style={[styles.visitTime, cancelled && styles.struck]}>
        {formatTimeRange(visit.scheduled_start, visit.scheduled_end)}
      </Text>
      <Text style={styles.schedule}>
        {SERVICE_LABEL[visit.booking.service_type]}
        {pets ? ` · ${pets}` : ''}
      </Text>
      <Text style={styles.muted}>
        {statusLabel(visit.status)}
        {visit.sitter ? ` · ${visit.sitter.full_name}` : ''}
      </Text>
      {canMove ? (
        <BigButton label="Ask to move this visit" variant="secondary" onPress={onReschedule} />
      ) : null}
    </View>
  );
}

export function OwnerBookingCard({ booking }: { booking: OwnerBooking }) {
  const router = useRouter();
  const cancel = useCancelBooking();
  const withdraw = useWithdrawScheduleChange();
  const org = useOrgSettings();
  const [checking, setChecking] = useState(false);
  const status = bookingStatus(booking.status);
  const pets = booking.booking_pets
    .map((bp) => bp.pet?.name)
    .filter(Boolean)
    .join(', ');
  const title = `${SERVICE_LABEL[booking.service_type]}${pets ? ` · ${pets}` : ''}`;
  const pending = (booking.schedule_change_requests ?? []).filter((r) => r.status === 'requested');
  const repeats = booking.recurrence_rule !== null || booking.service_type === 'multi_day';

  const confirmCancel = async () => {
    let message = cancelMessage(
      { cancelled: 0, late: 0, isLate: false },
      0,
      booking.status === 'confirmed' ? 'confirmed' : 'requested',
    );
    if (booking.status === 'confirmed') {
      setChecking(true);
      try {
        const now = new Date();
        const cutoff = org.data?.cancellationCutoffHours ?? 24;
        const upcoming = await fetchUpcomingBookingVisits(booking.id, now);
        message = cancelMessage(cancellationPreview(upcoming, now, cutoff), cutoff, 'confirmed');
      } catch {
        message = 'Upcoming visits will be cancelled. A visit already under way will still finish.';
      } finally {
        setChecking(false);
      }
    }
    Alert.alert('Cancel this booking?', message, [
      { text: 'Keep booking', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: () =>
          cancel.mutate(booking.id, {
            onError: (error) =>
              Alert.alert(
                'Couldn’t cancel',
                error instanceof Error && !('code' in error) ? error.message : 'Please try again.',
              ),
          }),
      },
    ]);
  };

  return (
    <View style={styles.card} accessible={false}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.schedule}>{describeSchedule(booking)}</Text>
      <Text style={[styles.status, styles[status.tone]]}>
        {status.label}
        {booking.status === 'confirmed' && booking.sitter ? ` · ${booking.sitter.full_name}` : ''}
      </Text>
      {booking.notes ? <Text style={styles.notes}>{booking.notes}</Text> : null}
      {pending.map((r) => (
        <View key={r.id} style={styles.request}>
          <Text style={styles.requestText}>
            {r.scope === 'visit'
              ? 'You asked to move a visit. Waiting for the business.'
              : `You asked to change times from ${formatCalendarDate(r.from_date!)}. Waiting for the business.`}
          </Text>
          <BigButton
            label="Withdraw request"
            variant="secondary"
            onPress={() => withdraw.mutate(r.id)}
            loading={withdraw.isPending && withdraw.variables === r.id}
          />
        </View>
      ))}
      {booking.status === 'confirmed' && repeats && booking.service_type !== 'multi_day' ? (
        <BigButton
          label="Change times from a date"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/my-bookings/reschedule', params: { bookingId: booking.id } })
          }
        />
      ) : null}
      {canOwnerCancel(booking.status) ? (
        <BigButton
          label="Cancel booking"
          variant="secondary"
          onPress={() => void confirmCancel()}
          loading={cancel.isPending || checking}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginTop: 8 },
  muted: { fontSize: 16, color: '#666666' },
  visit: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, gap: 4 },
  visitTime: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  struck: { textDecorationLine: 'line-through', color: '#888888' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 6 },
  title: { fontSize: 19, fontWeight: '700', color: '#1A1A1A' },
  schedule: { fontSize: 17, color: '#333333' },
  status: { fontSize: 16, fontWeight: '600' },
  waiting: { color: '#9A6700' },
  good: { color: '#1B7F3B' },
  bad: { color: '#C62828' },
  notes: { fontSize: 15, color: '#555555', marginBottom: 4 },
  request: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 10, gap: 8 },
  requestText: { fontSize: 15, color: '#6B4E00' },
});
