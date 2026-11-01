import { StyleSheet, Text, View } from 'react-native';

import { formatTime } from '@/features/visits/time';

import { statusTimeline, type TimelineStep } from './status-timeline';

/** On the way 11:52 · Arrived 12:03 · Caring for your pets 12:05 · Finished 12:35 */
export function VisitTimeline({ visit }: { visit: Parameters<typeof statusTimeline>[0] }) {
  const steps = statusTimeline(visit);
  return (
    <View style={styles.list} accessibilityRole="list">
      {steps.map((step, i) => (
        <Step key={step.key} step={step} last={i === steps.length - 1} />
      ))}
    </View>
  );
}

function Step({ step, last }: { step: TimelineStep; last: boolean }) {
  const time = step.at ? formatTime(step.at) : null;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${step.label}${time ? `, ${time}` : step.state === 'upcoming' ? ', not yet' : ''}`}
    >
      <View style={styles.rail}>
        <View style={[styles.dot, styles[step.state]]} />
        {last ? null : <View style={[styles.line, step.state === 'done' && styles.lineDone]} />}
      </View>
      <View style={styles.text}>
        <Text style={[styles.label, step.state === 'upcoming' && styles.muted]}>{step.label}</Text>
        {time ? <Text style={styles.time}>{time}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { flexDirection: 'row', gap: 12, minHeight: 44 },
  rail: { alignItems: 'center', width: 18 },
  dot: { width: 16, height: 16, borderRadius: 8, marginTop: 3 },
  done: { backgroundColor: '#2E7D32' },
  current: { backgroundColor: '#208AEF', borderWidth: 3, borderColor: '#BBDEFB' },
  upcoming: { backgroundColor: '#D6D6D6' },
  line: { flex: 1, width: 2, backgroundColor: '#D6D6D6', marginVertical: 2 },
  lineDone: { backgroundColor: '#2E7D32' },
  text: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12 },
  label: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  muted: { color: '#888888', fontWeight: '400' },
  time: { fontSize: 17, color: '#333333' },
});
