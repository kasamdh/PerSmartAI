import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime } from '@/features/visits/time';

import type { CareEventRow } from './api';
import { careEventSummary } from './care-events';

type CareTimelineProps = {
  events: CareEventRow[];
  /** Ids of events the current user may remove; empty when the visit is closed. */
  canRemove: (event: CareEventRow) => boolean;
  onRemove: (event: CareEventRow) => void;
};

export function CareTimeline({ events, canRemove, onRemove }: CareTimelineProps) {
  if (events.length === 0) {
    return <Text style={styles.empty}>Nothing logged yet.</Text>;
  }

  return (
    <View style={styles.list}>
      {events.map((event) => {
        const summary = careEventSummary(event.type, event.value, event.pet?.name);
        return (
          <View key={event.id} style={styles.row}>
            <Text style={styles.time}>{formatTime(event.occurred_at)}</Text>
            <Text style={styles.summary}>{summary}</Text>
            {canRemove(event) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove: ${summary}`}
                hitSlop={8}
                onPress={() => onRemove(event)}
                style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
              >
                <Text style={styles.removeLabel}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDDDDD',
  },
  time: {
    fontSize: 15,
    color: '#555555',
    width: 72,
  },
  summary: {
    flex: 1,
    fontSize: 17,
    color: '#1A1A1A',
  },
  remove: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 10,
  },
  removePressed: {
    backgroundColor: '#FDECEA',
  },
  removeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#C62828',
  },
  empty: {
    fontSize: 16,
    color: '#555555',
  },
});
