import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';
import { ErrorView, LoadingView } from '@/components/query-states';
import { formatCalendarDate } from '@/features/bookings/booking-text';
import { addDays, weekdayOf } from '@/features/scheduling';
import { groupByLocalDate, localDayRange, weekDates } from '@/features/scheduling/calendar';
import { SERVICE_LABELS } from '@/features/visits/visit-card';
import { formatTimeRange } from '@/features/visits/time';
import { useSitterVisits } from '@/features/visits/use-sitter-visits';
import { statusLabel } from '@/features/visits/visit-actions';
import { toDateString } from '@/lib/wall-clock';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The sitter's week, Monday to Sunday, one section per day. */
export function SitterWeekScreen() {
  const router = useRouter();
  const today = toDateString(new Date());
  const [anchor, setAnchor] = useState(today);
  const days = useMemo(() => weekDates(anchor), [anchor]);
  const range = useMemo(() => localDayRange(days[0], days[6]), [days]);
  const visits = useSitterVisits(range);
  const byDay = useMemo(() => groupByLocalDate(visits.data ?? []), [visits.data]);

  if (visits.isPending) return <LoadingView label="Loading your week" />;
  if (visits.isError) return <ErrorView onRetry={() => visits.refetch()} />;

  const total = visits.data.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={visits.isRefetching}
            onRefresh={() => void visits.refetch()}
          />
        }
      >
        <Text style={styles.heading} accessibilityRole="header">
          {formatCalendarDate(days[0])} – {formatCalendarDate(days[6])}
        </Text>
        <Text style={styles.summary}>
          {total === 0 ? 'No visits this week' : `${total} visit${total === 1 ? '' : 's'}`}
        </Text>

        {days.map((date) => {
          const list = byDay.get(date) ?? [];
          return (
            <View key={date} style={styles.day}>
              <Text style={[styles.dayTitle, date === today && styles.today]}>
                {DAY[weekdayOf(date)]} {formatCalendarDate(date)}
                {date === today ? ' · Today' : ''}
              </Text>
              {list.length === 0 ? (
                <Text style={styles.free}>Free</Text>
              ) : (
                list.map((v) => (
                  <Pressable
                    key={v.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${SERVICE_LABELS[v.booking.service_type]} at ${
                      v.booking.household.name ?? v.booking.household.address_line1
                    }, ${formatTimeRange(v.scheduled_start, v.scheduled_end)}`}
                    onPress={() => router.push({ pathname: '/visit/[id]', params: { id: v.id } })}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Text style={styles.rowTime}>
                      {formatTimeRange(v.scheduled_start, v.scheduled_end)}
                    </Text>
                    <Text style={styles.rowPlace} numberOfLines={1}>
                      {SERVICE_LABELS[v.booking.service_type]} ·{' '}
                      {v.booking.household.name ?? v.booking.household.address_line1}
                    </Text>
                    <Text style={styles.rowStatus}>{statusLabel(v.status)}</Text>
                  </Pressable>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.nav}>
        <BigButton
          label="‹ Last week"
          variant="secondary"
          style={styles.navButton}
          onPress={() => setAnchor(addDays(days[0], -7))}
        />
        <BigButton
          label="Next week ›"
          variant="secondary"
          style={styles.navButton}
          onPress={() => setAnchor(addDays(days[0], 7))}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 24, fontWeight: '700', color: '#1A1A1A' },
  summary: { fontSize: 17, color: '#555555' },
  day: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, gap: 6 },
  dayTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  today: { color: '#0B5CAD' },
  free: { fontSize: 16, color: '#777777' },
  row: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDDDDD',
    paddingVertical: 6,
  },
  pressed: { opacity: 0.6 },
  rowTime: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  rowPlace: { fontSize: 16, color: '#333333' },
  rowStatus: { fontSize: 14, color: '#0B5CAD' },
  nav: { flexDirection: 'row', gap: 12, padding: 16, paddingTop: 8 },
  navButton: { flex: 1 },
});
