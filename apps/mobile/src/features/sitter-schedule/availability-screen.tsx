import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { DateTimeField } from '@/components/date-time-field';
import { ErrorView, LoadingView } from '@/components/query-states';
import { formatClock } from '@/features/bookings/booking-text';
import { useOrgSettings } from '@/features/scheduling/hooks';

import { useAddAvailability, useAvailability, useRemoveAvailability } from './hooks';
import { availabilityByWeekday, validateAvailabilityBlock } from './logic';

const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
  value: String(d),
  label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d],
}));

/** Weekly hours the sitter can work. Admins can only book them inside these hours. */
export function AvailabilityScreen() {
  const availability = useAvailability();
  const org = useOrgSettings();
  const add = useAddAvailability();
  const remove = useRemoveAvailability();
  const [weekday, setWeekday] = useState('1');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [error, setError] = useState<string | null>(null);

  if (availability.isPending) return <LoadingView label="Loading your hours" />;
  if (availability.isError) return <ErrorView onRetry={() => availability.refetch()} />;

  const days = availabilityByWeekday(availability.data);

  const onAdd = () => {
    const block = { weekday: Number(weekday), start_time: start, end_time: end };
    const problem = validateAvailabilityBlock(block, availability.data);
    setError(problem);
    if (problem) return;
    add.mutate(block, {
      onError: (e) => setError(e.message || 'Couldn’t save. Please try again.'),
    });
  };

  const onRemove = (id: string, label: string) =>
    Alert.alert('Remove these hours?', label, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(
            { id },
            { onError: (e) => Alert.alert('Couldn’t remove', e.message || 'Please try again.') },
          ),
      },
    ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          The hours you can take visits each week
          {org.data ? ` (${org.data.timeZone.replace(/_/g, ' ')} time)` : ''}. You won’t be booked
          outside them.
        </Text>

        {days.map((day) => (
          <View key={day.weekday} style={styles.day}>
            <Text style={styles.dayName}>{day.name}</Text>
            {day.blocks.length === 0 ? (
              <Text style={styles.off}>Not available</Text>
            ) : (
              day.blocks.map((b) => {
                const label = `${formatClock(b.start_time)} – ${formatClock(b.end_time)}`;
                return (
                  <Pressable
                    key={b.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${day.name} ${label}`}
                    accessibilityHint="Removes these hours"
                    onPress={() => onRemove(b.id, `${day.name} ${label}`)}
                    style={({ pressed }) => [styles.block, pressed && styles.pressed]}
                  >
                    <Text style={styles.blockText}>{label}</Text>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                );
              })
            )}
          </View>
        ))}

        <View style={styles.form}>
          <Text style={styles.formTitle}>Add hours</Text>
          <ChoiceChips
            label="Day"
            options={WEEKDAY_OPTIONS}
            value={weekday}
            onChange={setWeekday}
          />
          <DateTimeField mode="time" label="From" value={start} onChange={setStart} />
          <DateTimeField mode="time" label="Until" value={end} onChange={setEnd} />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <BigButton label="Add these hours" onPress={onAdd} loading={add.isPending} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12 },
  intro: { fontSize: 16, color: '#444444' },
  day: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, gap: 6 },
  dayName: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  off: { fontSize: 16, color: '#666666' },
  block: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EEF5FD',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  pressed: { opacity: 0.6 },
  blockText: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  remove: { fontSize: 15, fontWeight: '600', color: '#C62828' },
  form: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, gap: 10 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  error: { fontSize: 16, color: '#C62828' },
  footer: { padding: 16, paddingTop: 8 },
});
