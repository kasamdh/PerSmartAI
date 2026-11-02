import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MIN_TAP_TARGET } from '@/components/big-button';

import { saveToPhone } from './save-to-phone';
import { ZoomableImage } from './zoomable-image';

export type ViewerItem = {
  id: string;
  type: 'photo' | 'video';
  url: string | null;
  caption: string | null;
  hearts: number;
  media_reactions: { user_id: string }[];
};

/** Full screen: zoomable photos, playable videos, heart and save to phone. */
export function MediaViewer({
  items,
  index,
  viewerId,
  canReact,
  onToggleHeart,
  onChangeIndex,
  onClose,
}: {
  items: ViewerItem[];
  /** Null hides the viewer. */
  index: number | null;
  viewerId: string | null;
  canReact: boolean;
  onToggleHeart: (item: ViewerItem, hearted: boolean) => void;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const item = index === null ? null : (items[index] ?? null);
  const hearted = !!item && item.media_reactions.some((r) => r.user_id === viewerId);

  const save = async () => {
    if (!item?.url) return;
    setSaving(true);
    try {
      const ok = await saveToPhone(item.url, item.type);
      Alert.alert(
        ok ? 'Saved' : 'Can’t save',
        ok
          ? `The ${item.type} is in your photos.`
          : 'Allow Petsitters to add to your photos in Settings.',
      );
    } catch {
      Alert.alert('Couldn’t save', 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!item} animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.top}>
            <Text style={styles.counter}>
              {index !== null ? `${index + 1} of ${items.length}` : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.iconButton}
            >
              <Text style={styles.iconLabel}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.stage}>
            {item?.url ? (
              item.type === 'video' ? (
                <VideoClip key={item.id} url={item.url} />
              ) : (
                <ZoomableImage
                  key={item.id}
                  uri={item.url}
                  label={item.caption ?? `Photo ${index! + 1}`}
                />
              )
            ) : (
              <Text style={styles.caption}>This one isn’t available.</Text>
            )}
          </View>

          {item?.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}

          <View style={styles.bottom}>
            <ToolButton
              label="‹"
              accessibilityLabel="Previous"
              disabled={index === null || index === 0}
              onPress={() => index !== null && onChangeIndex(index - 1)}
            />
            {canReact && item ? (
              <ToolButton
                label={`${hearted ? '♥' : '♡'} ${item.hearts || ''}`.trim()}
                accessibilityLabel={hearted ? 'Remove heart' : 'Heart this'}
                active={hearted}
                onPress={() => onToggleHeart(item, !hearted)}
              />
            ) : item && item.hearts > 0 ? (
              <Text style={styles.hearts}>♥ {item.hearts}</Text>
            ) : null}
            <ToolButton
              label={saving ? 'Saving…' : 'Save'}
              accessibilityLabel={`Save this ${item?.type ?? 'photo'} to your phone`}
              disabled={saving || !item?.url}
              onPress={() => void save()}
            />
            <ToolButton
              label="›"
              accessibilityLabel="Next"
              disabled={index === null || index >= items.length - 1}
              onPress={() => index !== null && onChangeIndex(index + 1)}
            />
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function VideoClip({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      contentFit="contain"
      accessibilityLabel="Visit video"
    />
  );
}

function ToolButton({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
  active = false,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tool,
        active && styles.toolActive,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.toolLabel, active && styles.toolLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#000000' },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  counter: { color: '#CCCCCC', fontSize: 15 },
  iconButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: { color: '#FFFFFF', fontSize: 26 },
  stage: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  caption: { color: '#FFFFFF', fontSize: 17, textAlign: 'center', padding: 12 },
  bottom: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center' },
  tool: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    borderRadius: 14,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolActive: { backgroundColor: '#C2185B' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
  toolLabel: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  toolLabelActive: { color: '#FFFFFF' },
  hearts: { flex: 1, color: '#F48FB1', fontSize: 18, textAlign: 'center' },
});
