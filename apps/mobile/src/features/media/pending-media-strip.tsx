import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TAP_TARGET } from '@/components/big-button';

import { queueStatusLabel } from './media-logic';
import type { MediaQueueItem } from './upload-queue';

/** Photos and videos still on their way, each with its upload status. */
export function PendingMediaStrip({
  items,
  onRetry,
}: {
  items: MediaQueueItem[];
  onRetry: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View
          key={item.id}
          style={styles.row}
          accessible={item.status !== 'failed'}
          accessibilityLabel={`${item.mediaType === 'video' ? 'Video' : 'Photo'}: ${queueStatusLabel(item.status)}`}
        >
          <Image
            accessible={false}
            source={{ uri: item.thumbUri }}
            style={styles.thumb}
            contentFit="cover"
          />
          <View style={styles.status}>
            <View style={styles.statusRow}>
              {item.status === 'uploading' || item.status === 'queued' ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text style={[styles.icon, styles[item.status]]}>
                  {item.status === 'sent' ? '✓' : item.status === 'waiting' ? '⏸' : '!'}
                </Text>
              )}
              <Text style={[styles.label, styles[item.status]]}>
                {queueStatusLabel(item.status)}
              </Text>
            </View>
            {item.caption ? (
              <Text style={styles.caption} numberOfLines={1}>
                {item.caption}
              </Text>
            ) : null}
            {item.status === 'failed' && item.lastError ? (
              <Text style={styles.caption} numberOfLines={2}>
                {item.lastError}
              </Text>
            ) : null}
          </View>
          {item.status === 'failed' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retry sending this ${item.mediaType}`}
              onPress={() => onRetry(item.id)}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Text style={styles.retryLabel}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#EEEEEE' },
  status: { flex: 1, gap: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 16, fontWeight: '600' },
  queued: { color: '#0B5CAD' },
  uploading: { color: '#0B5CAD' },
  sent: { color: '#1B7F3B' },
  waiting: { color: '#855A00' },
  failed: { color: '#C62828' },
  caption: { fontSize: 14, color: '#555555' },
  retry: {
    minHeight: MIN_TAP_TARGET,
    minWidth: 88,
    borderRadius: 12,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  retryLabel: { fontSize: 17, fontWeight: '700', color: '#C62828' },
});
