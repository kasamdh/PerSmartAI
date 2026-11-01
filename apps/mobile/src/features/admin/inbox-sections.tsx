import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { schedulingErrorText } from '@/features/scheduling/api';
import { formatDayAndTime, formatTimeRange } from '@/features/visits/time';

import { describeChangeRequest } from './schedule-logic';
import {
  useChangeRequests,
  useDecideChangeRequest,
  useDecideTimeOff,
  useTimeOffRequests,
} from './schedule-hooks';

const SERVICE_LABELS = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight',
  multi_day: 'Multi-day',
} as const;

/** Owners' reschedule requests. Approving applies the change with conflict checks. */
export function ChangeRequestsSection() {
  const requests = useChangeRequests();
  const decide = useDecideChangeRequest();

  if (requests.isPending) return <ActivityIndicator accessibilityLabel="Loading requests" />;
  if (requests.isError) {
    return <BigButton label="Couldn't load. Try again" onPress={() => requests.refetch()} />;
  }
  if (requests.data.length === 0) return <Text style={styles.muted}>No reschedule requests.</Text>;

  const run = (id: string, approve: boolean) =>
    decide.mutate(
      { id, approve },
      {
        onError: (error) =>
          Alert.alert(
            approve ? 'Couldn’t apply this change' : 'Couldn’t decline',
            schedulingErrorText(error),
          ),
      },
    );

  return (
    <>
      {requests.data.map((r) => {
        const place = r.booking?.household?.name ?? r.booking?.household?.address_line1 ?? '';
        const busy = decide.isPending && decide.variables?.id === r.id;
        return (
          <View key={r.id} style={styles.card}>
            <Text style={styles.title}>
              {r.booking ? SERVICE_LABELS[r.booking.service_type] : 'Booking'} · {place}
            </Text>
            <Text style={styles.body}>{r.booking?.household?.owner?.full_name}</Text>
            {r.visit ? (
              <Text style={styles.body}>
                Now: {formatDayAndTime(r.visit.scheduled_start, new Date())} (
                {formatTimeRange(r.visit.scheduled_start, r.visit.scheduled_end)})
              </Text>
            ) : null}
            <Text style={styles.change}>
              {describeChangeRequest({
                scope: r.scope,
                from_date: r.from_date,
                changes: r.changes as Record<string, unknown>,
              })}
            </Text>
            {r.note ? <Text style={styles.note}>“{r.note}”</Text> : null}
            <View style={styles.actions}>
              <BigButton
                label="Decline"
                variant="secondary"
                style={styles.action}
                disabled={busy}
                onPress={() => run(r.id, false)}
              />
              <BigButton
                label="Approve"
                style={styles.action}
                loading={busy}
                onPress={() => run(r.id, true)}
              />
            </View>
          </View>
        );
      })}
    </>
  );
}

/** Sitters' time off requests. Approved time off blocks scheduling. */
export function TimeOffRequestsSection() {
  const requests = useTimeOffRequests();
  const decide = useDecideTimeOff();

  if (requests.isPending) return <ActivityIndicator accessibilityLabel="Loading time off" />;
  if (requests.isError) {
    return <BigButton label="Couldn't load. Try again" onPress={() => requests.refetch()} />;
  }
  if (requests.data.length === 0) return <Text style={styles.muted}>No time off requests.</Text>;

  const now = new Date();
  return (
    <>
      {requests.data.map((t) => {
        const busy = decide.isPending && decide.variables?.id === t.id;
        const run = (approve: boolean) =>
          decide.mutate(
            { id: t.id, approve },
            { onError: (e) => Alert.alert('Couldn’t save', e.message || 'Please try again.') },
          );
        return (
          <View key={t.id} style={styles.card}>
            <Text style={styles.title}>{t.sitter?.full_name}</Text>
            <Text style={styles.body}>
              {formatDayAndTime(t.start_at, now)} → {formatDayAndTime(t.end_at, now)}
            </Text>
            {t.reason ? <Text style={styles.note}>“{t.reason}”</Text> : null}
            <View style={styles.actions}>
              <BigButton
                label="Decline"
                variant="secondary"
                style={styles.action}
                disabled={busy}
                onPress={() => run(false)}
              />
              <BigButton
                label="Approve"
                style={styles.action}
                loading={busy}
                onPress={() => run(true)}
              />
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 16, color: '#666666' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 14,
    gap: 6,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  body: { fontSize: 16, color: '#333333' },
  change: { fontSize: 17, fontWeight: '600', color: '#0B5CAD' },
  note: { fontSize: 15, color: '#555555', fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  action: { flex: 1 },
});
