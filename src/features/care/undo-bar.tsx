import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TAP_TARGET } from '@/components/big-button';

export const UNDO_SECONDS = 5;

/** "Fed Rex (all) · Undo" for a few seconds after each care tap. */
export function UndoBar({
  message,
  onUndo,
  onDismiss,
}: {
  /** Null hides the bar. Each new message restarts the countdown. */
  message: string | null;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, UNDO_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Undo: ${message}`}
        onPress={onUndo}
        hitSlop={8}
        style={({ pressed }) => [styles.undo, pressed && styles.pressed]}
      >
        <Text style={styles.undoLabel}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1F2937',
    borderRadius: 14,
    paddingLeft: 16,
    paddingRight: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: MIN_TAP_TARGET + 8,
  },
  message: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  undo: {
    minHeight: MIN_TAP_TARGET,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  pressed: { backgroundColor: '#374151' },
  undoLabel: { color: '#93C5FD', fontSize: 18, fontWeight: '700' },
});
