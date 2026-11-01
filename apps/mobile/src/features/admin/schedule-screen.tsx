import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { ErrorView, LoadingView } from '@/components/query-states';
import { formatCalendarDate } from '@/features/bookings/booking-text';
import { addDays, weekdayOf } from '@/features/scheduling';
import { localDayRange, weekDates } from '@/features/scheduling/calendar';
import { formatTimeRange } from '@/features/visits/time';
import { statusLabel } from '@/features/visits/visit-actions';
import { toDateString } from '@/lib/wall-clock';

import { useSitters } from './hooks';
import type { ScheduleVisit } from './schedule-api';
import { useScheduleVisits } from './schedule-hooks';
import { groupBySitter, weekGrid } from './schedule-logic';

const SERVICE_LABELS = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight',
  multi_day: 'Multi-day',
} as const;
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VIEWS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
] as const;

/** Every sitter's visits for a day or a week; tap a visit to reassign or move it. */
export function ScheduleScreen() {
  const router = useRouter();
  const today = toDateString(new Date());
  const [view, setView] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(today);
  const days = useMemo(() => weekDates(date), [date]);
  const range = useMemo(
    () => (view === 'day' ? localDayRange(date, date) : localDayRange(days[0], days[6])),
    [view, date, days],
  );
  const visits = useScheduleVisits(range);
  const sitters = useSitters();

  if (visits.isPending || sitters.isPending) return <LoadingView label="Loading the schedule" />;
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

  const step = view === 'day' ? 1 : 7;
  const title =
    view === 'day'
      ? `${DAY[weekdayOf(date)]} ${formatCalendarDate(date)}${date === today ? ' · Today' : ''}`
      : `${formatCalendarDate(days[0])} – ${formatCalendarDate(days[6])}`;
  const open = (v: ScheduleVisit) =>
    router.push({ pathname: '/manage-visit/[id]', params: { id: v.id } });

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
        <ChoiceChips options={VIEWS} value={view} onChange={setView} />
        <Text style={styles.heading} accessibilityRole="header">
          {title}
        </Text>

        {view === 'day' ? (
          groupBySitter(visits.data, sitters.data).map((group) => (
            <View
              key={group.key}
              style={[styles.group, group.sitterId === null && styles.unassigned]}
            >
              <Text style={styles.groupTitle}>
                {group.title} · {group.visits.length}
              </Text>
              {group.visits.length === 0 ? (
                <Text style={styles.free}>Free</Text>
              ) : (
                group.visits.map((v) => (
                  <Pressable
                    key={v.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatTimeRange(v.scheduled_start, v.scheduled_end)}, ${
                      SERVICE_LABELS[v.booking.service_type]
                    } at ${v.booking.household.name ?? v.booking.household.address_line1}`}
                    onPress={() => open(v)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Text style={styles.rowTime}>
                      {formatTimeRange(v.scheduled_start, v.scheduled_end)}
                    </Text>
                    <Text style={styles.rowBody} numberOfLines={1}>
                      {SERVICE_LABELS[v.booking.service_type]} ·{' '}
                      {v.booking.household.name ?? v.booking.household.address_line1}
                    </Text>
                    <Text style={styles.rowStatus}>
                      {statusLabel(v.status)}
                      {v.slot_start !== v.scheduled_start ? ' · moved' : ''}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          ))
        ) : (
          <WeekTable
            visits={visits.data}
            sitters={sitters.data}
            date={date}
            onPickDay={(d) => {
              setDate(d);
              setView('day');
            }}
          />
        )}
      </ScrollView>
      <View style={styles.nav}>
        <BigButton
          label={view === 'day' ? '‹ Previous day' : '‹ Last week'}
          variant="secondary"
          style={styles.navButton}
          onPress={() => setDate(addDays(date, -step))}
        />
        <BigButton
          label={view === 'day' ? 'Next day ›' : 'Next week ›'}
          variant="secondary"
          style={styles.navButton}
          onPress={() => setDate(addDays(date, step))}
        />
      </View>
    </SafeAreaView>
  );
}

function WeekTable({
  visits,
  sitters,
  date,
  onPickDay,
}: {
  visits: ScheduleVisit[];
  sitters: { id: string; full_name: string }[];
  date: string;
  onPickDay: (date: string) => void;
}) {
  const grid = weekGrid(visits, sitters, date);
  const unassigned = grid.days.map(
    (d) =>
      visits.filter((v) => !v.sitter_id && toDateString(new Date(v.scheduled_start)) === d).length,
  );
  return (
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <Text style={[styles.nameCell, styles.headCell]}>Sitter</Text>
        {grid.days.map((d) => (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityLabel={`Open ${formatCalendarDate(d)}`}
            onPress={() => onPickDay(d)}
            style={styles.dayCell}
          >
            <Text style={styles.headCell}>{DAY[weekdayOf(d)].slice(0, 2)}</Text>
            <Text style={styles.headDate}>{Number(d.slice(8))}</Text>
          </Pressable>
        ))}
      </View>
      {unassigned.some((n) => n > 0) ? (
        <View style={[styles.tableRow, styles.unassigned]}>
          <Text style={[styles.nameCell, styles.warn]}>Needs a sitter</Text>
          {unassigned.map((n, i) => (
            <Text key={grid.days[i]} style={[styles.countCell, n > 0 && styles.warn]}>
              {n || ''}
            </Text>
          ))}
        </View>
      ) : null}
      {grid.rows.map((row) => (
        <View key={row.sitterId} style={styles.tableRow}>
          <Text style={styles.nameCell} numberOfLines={1}>
            {row.name}
          </Text>
          {row.counts.map((n, i) => (
            <Text key={grid.days[i]} style={styles.countCell}>
              {n || '·'}
            </Text>
          ))}
        </View>
      ))}
      <Text style={styles.hint}>Visits per day. Tap a day to see it.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  group: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, gap: 4 },
  unassigned: { borderWidth: 2, borderColor: '#F0A202' },
  groupTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  free: { fontSize: 16, color: '#666666' },
  row: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDDDDD',
    paddingVertical: 6,
  },
  pressed: { opacity: 0.6 },
  rowTime: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  rowBody: { fontSize: 16, color: '#333333' },
  rowStatus: { fontSize: 14, color: '#0B5CAD' },
  table: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 8, gap: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderRadius: 8 },
  nameCell: { flex: 2.4, fontSize: 15, fontWeight: '600', color: '#1A1A1A', paddingRight: 4 },
  headCell: { fontSize: 13, fontWeight: '700', color: '#555555', textAlign: 'center' },
  headDate: { fontSize: 13, color: '#555555', textAlign: 'center' },
  dayCell: { flex: 1, minHeight: 48, justifyContent: 'center' },
  countCell: { flex: 1, textAlign: 'center', fontSize: 16, color: '#1A1A1A' },
  warn: { color: '#B71C1C', fontWeight: '700' },
  hint: { fontSize: 14, color: '#666666', padding: 4 },
  nav: { flexDirection: 'row', gap: 12, padding: 16, paddingTop: 8 },
  navButton: { flex: 1 },
});
