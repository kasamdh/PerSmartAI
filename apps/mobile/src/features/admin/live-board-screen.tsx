import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyView, ErrorView, LoadingView } from '@/components/query-states';
import { formatTime, formatTimeRange } from '@/features/visits/time';
import { statusLabel } from '@/features/visits/visit-actions';

import { useTodaysVisits } from './hooks';
import { checkInTiming, LATE_GRACE_MINUTES, sortForBoard } from './live-board';

const SERVICE_LABELS = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight',
  multi_day: 'Multi-day',
} as const;

/** Re-evaluates lateness every 30 seconds even when nothing changes in the data. */
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Every visit today and where it stands, live. Late check-ins are red and first. */
export function LiveBoardScreen() {
  const router = useRouter();
  const visits = useTodaysVisits();
  const now = useMinuteClock();

  if (visits.isPending) return <LoadingView label="Loading today's visits" />;
  if (visits.isError) return <ErrorView onRetry={() => visits.refetch()} />;

  const rows = sortForBoard(visits.data, now);
  const late = rows.filter((v) => checkInTiming(v, now).late && !v.check_in_at).length;
  const active = rows.filter((v) =>
    ['on_the_way', 'arrived', 'in_progress'].includes(v.status),
  ).length;
  const done = rows.filter((v) => v.status === 'completed').length;

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
        <View style={styles.summary} accessibilityLiveRegion="polite">
          <Stat label="Late" value={late} tone={late ? 'bad' : 'muted'} />
          <Stat label="Under way" value={active} tone="good" />
          <Stat label="Done" value={done} tone="muted" />
          <Stat label="Total" value={rows.length} tone="muted" />
        </View>
        <Text style={styles.hint}>
          Late: not checked in {LATE_GRACE_MINUTES} minutes after the start. Updates live.
        </Text>

        {rows.length === 0 ? (
          <EmptyView title="No visits today" />
        ) : (
          rows.map((v) => {
            const timing = checkInTiming(v, now);
            const place = v.booking.household.name ?? v.booking.household.address_line1;
            return (
              <Pressable
                key={v.id}
                accessibilityRole="button"
                accessibilityLabel={`${place}, ${statusLabel(v.status)}${timing.label ? `, ${timing.label}` : ''}`}
                onPress={() =>
                  router.push({ pathname: '/visit-overview/[id]', params: { id: v.id } })
                }
                style={({ pressed }) => [
                  styles.card,
                  timing.late && styles.lateCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.row}>
                  <Text style={styles.time}>
                    {formatTimeRange(v.scheduled_start, v.scheduled_end)}
                  </Text>
                  <Text style={[styles.badge, timing.late && !v.check_in_at && styles.badgeLate]}>
                    {statusLabel(v.status)}
                  </Text>
                </View>
                <Text style={styles.body}>
                  {SERVICE_LABELS[v.booking.service_type]} · {place}
                </Text>
                <Text style={[styles.body, !v.sitter && styles.lateText]}>
                  {v.sitter ? v.sitter.full_name : 'No sitter assigned'}
                </Text>
                {timing.label ? <Text style={styles.lateText}>{timing.label}</Text> : null}
                {v.check_in_at && !timing.late ? (
                  <Text style={styles.meta}>
                    In {formatTime(v.check_in_at)}
                    {v.check_out_at ? ` · out ${formatTime(v.check_out_at)}` : ''}
                  </Text>
                ) : null}
                {v.status_line ? <Text style={styles.statusLine}>“{v.status_line}”</Text> : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'bad' | 'good' | 'muted';
}) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, styles[tone]]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 10 },
  summary: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 14, color: '#555555' },
  bad: { color: '#C62828' },
  good: { color: '#1B7F3B' },
  muted: { color: '#1A1A1A' },
  hint: { fontSize: 14, color: '#666666' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 14,
    gap: 3,
    minHeight: 88,
  },
  lateCard: { borderColor: '#C62828', borderWidth: 2, backgroundColor: '#FEF3F2' },
  pressed: { opacity: 0.75 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  time: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', flexShrink: 1 },
  badge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B5CAD',
    backgroundColor: '#E3F0FD',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  badgeLate: { color: '#FFFFFF', backgroundColor: '#C62828' },
  body: { fontSize: 16, color: '#333333' },
  lateText: { fontSize: 16, fontWeight: '700', color: '#C62828' },
  meta: { fontSize: 15, color: '#555555' },
  statusLine: { fontSize: 15, color: '#1B5E20', fontStyle: 'italic' },
});
