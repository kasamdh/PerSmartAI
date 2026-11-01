import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { ErrorView, LoadingView } from '@/components/query-states';
import { formatCalendarDate } from '@/features/bookings/booking-text';
import { addDays } from '@/features/scheduling';
import { localDayRange, sitterWorkload, weekDates } from '@/features/scheduling/calendar';
import { toDateString } from '@/lib/wall-clock';

import { useSitters } from './hooks';
import { useScheduleVisits } from './schedule-hooks';

const hours = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
};

/** Visits, hours and working days per sitter for a week, busiest first. */
export function WorkloadScreen() {
  const [anchor, setAnchor] = useState(toDateString(new Date()));
  const days = useMemo(() => weekDates(anchor), [anchor]);
  const range = useMemo(() => localDayRange(days[0], days[6]), [days]);
  const visits = useScheduleVisits(range);
  const sitters = useSitters();

  if (visits.isPending || sitters.isPending) return <LoadingView label="Loading workload" />;
  if (visits.isError || sitters.isError) {
    return (
      <ErrorView
        onRetry={() => {
          void visits.refetch();
          void sitters.refetch();
        }}
      />
    );
  }

  const rows = sitterWorkload(visits.data, sitters.data).sort(
    (a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name),
  );
  const busiest = Math.max(1, ...rows.map((r) => r.minutes));
  const unassigned = visits.data.filter((v) => !v.sitter_id).length;

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
        {unassigned > 0 ? (
          <Text style={styles.warn}>
            {unassigned} visit{unassigned === 1 ? '' : 's'} still need a sitter.
          </Text>
        ) : null}
        {rows.map((r) => (
          <View
            key={r.sitterId}
            style={styles.card}
            accessible
            accessibilityLabel={`${r.name}: ${r.visits} visits, ${hours(r.minutes)}, ${r.days} days`}
          >
            <Text style={styles.name}>{r.name}</Text>
            <Text style={styles.stats}>
              {r.visits} visit{r.visits === 1 ? '' : 's'} · {hours(r.minutes)} · {r.days} day
              {r.days === 1 ? '' : 's'}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { width: `${(r.minutes / busiest) * 100}%` }]} />
            </View>
          </View>
        ))}
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
  heading: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  warn: { fontSize: 16, fontWeight: '600', color: '#B71C1C' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, gap: 6 },
  name: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  stats: { fontSize: 16, color: '#333333' },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: '#E8EEF5', overflow: 'hidden' },
  bar: { height: 10, borderRadius: 5, backgroundColor: '#1565C0' },
  nav: { flexDirection: 'row', gap: 12, padding: 16, paddingTop: 8 },
  navButton: { flex: 1 },
});
