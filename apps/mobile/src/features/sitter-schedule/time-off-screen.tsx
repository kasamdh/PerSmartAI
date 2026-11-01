import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { DateTimeField } from '@/components/date-time-field';
import { ErrorView, LoadingView } from '@/components/query-states';
import { TextField } from '@/components/text-field';
import { formatDayAndTime } from '@/features/visits/time';
import { toDateString } from '@/lib/wall-clock';

import { useRequestTimeOff, useTimeOff, useWithdrawTimeOff } from './hooks';
import { timeOffRange, timeOffStatusLabel } from './logic';

/** Sitters ask for time off; an admin approves it. Approved time off blocks bookings. */
export function TimeOffScreen() {
  const today = toDateString(new Date());
  const timeOff = useTimeOff();
  const request = useRequestTimeOff();
  const withdraw = useWithdrawTimeOff();

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (timeOff.isPending) return <LoadingView label="Loading your time off" />;
  if (timeOff.isError) return <ErrorView onRetry={() => timeOff.refetch()} />;

  const onSubmit = () => {
    const range = timeOffRange({ startDate, endDate, allDay, startTime, endTime }, new Date());
    if (!range.ok) {
      setError(range.error);
      return;
    }
    setError(null);
    request.mutate(
      { start_at: range.start_at, end_at: range.end_at, reason },
      {
        onSuccess: () => {
          setReason('');
          Alert.alert('Request sent', 'You’ll see here when it’s approved.');
        },
        onError: (e) => setError(e.message || 'Couldn’t send. Please try again.'),
      },
    );
  };

  const onWithdraw = (id: string) =>
    Alert.alert('Withdraw this time off?', undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () =>
          withdraw.mutate(
            { id },
            { onError: (e) => Alert.alert('Couldn’t withdraw', e.message || 'Please try again.') },
          ),
      },
    ]);

  const now = new Date();

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading} accessibilityRole="header">
          Upcoming time off
        </Text>
        {timeOff.data.length === 0 ? (
          <Text style={styles.empty}>None yet.</Text>
        ) : (
          timeOff.data.map((t) => (
            <View key={t.id} style={styles.card}>
              <Text style={styles.range}>
                {formatDayAndTime(t.start_at, now)} → {formatDayAndTime(t.end_at, now)}
              </Text>
              <Text style={[styles.status, styles[t.status]]}>{timeOffStatusLabel(t.status)}</Text>
              {t.reason ? <Text style={styles.reason}>{t.reason}</Text> : null}
              {t.status === 'requested' ||
              (t.status === 'approved' && new Date(t.start_at) > now) ? (
                <BigButton
                  label="Withdraw"
                  variant="secondary"
                  onPress={() => onWithdraw(t.id)}
                  loading={withdraw.isPending && withdraw.variables?.id === t.id}
                />
              ) : null}
            </View>
          ))
        )}

        <View style={styles.form}>
          <Text style={styles.heading}>Ask for time off</Text>
          <DateTimeField
            mode="date"
            label="First day"
            value={startDate}
            minimumDate={today}
            onChange={(v) => {
              setStartDate(v);
              if (endDate < v) setEndDate(v);
            }}
          />
          <DateTimeField
            mode="date"
            label="Last day"
            value={endDate}
            minimumDate={startDate || today}
            onChange={setEndDate}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>All day</Text>
            <Switch value={allDay} onValueChange={setAllDay} accessibilityLabel="All day" />
          </View>
          {allDay ? null : (
            <>
              <DateTimeField
                mode="time"
                label="From (first day)"
                value={startTime}
                onChange={setStartTime}
              />
              <DateTimeField
                mode="time"
                label="Until (last day)"
                value={endTime}
                onChange={setEndTime}
              />
            </>
          )}
          <TextField
            label="Reason (optional)"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Family wedding"
            maxLength={200}
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <BigButton label="Send request" onPress={onSubmit} loading={request.isPending} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  empty: { fontSize: 16, color: '#777777' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, gap: 6 },
  range: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  status: { fontSize: 16, fontWeight: '600' },
  requested: { color: '#9A6700' },
  approved: { color: '#1B7F3B' },
  declined: { color: '#C62828' },
  reason: { fontSize: 15, color: '#555555' },
  form: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, gap: 10 },
  switchRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  error: { fontSize: 16, color: '#C62828' },
  footer: { padding: 16, paddingTop: 8 },
});
