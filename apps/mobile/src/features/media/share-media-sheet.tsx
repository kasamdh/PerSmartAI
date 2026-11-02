import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { MultiChoiceChips } from '@/components/multi-choice-chips';
import { TextField } from '@/components/text-field';

import type { PickedMedia } from './prepare';

/** Before sending: who's in it and an optional caption, for the whole batch. */
export function ShareMediaSheet({
  items,
  pets,
  progress,
  onCancel,
  onSend,
}: {
  /** Null hides the sheet. */
  items: PickedMedia[] | null;
  pets: { id: string; name: string }[];
  /** "Preparing 2 of 5" while sending, else null. */
  progress: string | null;
  onCancel: () => void;
  onSend: (details: { caption: string; petIds: string[] }) => void;
}) {
  return (
    <Modal visible={items !== null} animationType="slide" onRequestClose={onCancel}>
      {/* Mounted per opening, so the caption and pets start fresh each time. */}
      {items ? (
        <ShareForm
          items={items}
          pets={pets}
          progress={progress}
          onCancel={onCancel}
          onSend={onSend}
        />
      ) : null}
    </Modal>
  );
}

function ShareForm({
  items,
  pets,
  progress,
  onCancel,
  onSend,
}: {
  items: PickedMedia[];
  pets: { id: string; name: string }[];
  progress: string | null;
  onCancel: () => void;
  onSend: (details: { caption: string; petIds: string[] }) => void;
}) {
  const [caption, setCaption] = useState('');
  const [petIds, setPetIds] = useState<string[]>(pets.map((p) => p.id));

  const count = items?.length ?? 0;
  const videos = items?.filter((i) => i.type === 'video').length ?? 0;
  const what =
    videos === 0
      ? `${count} photo${count === 1 ? '' : 's'}`
      : videos === count
        ? `${count} video${count === 1 ? '' : 's'}`
        : `${count} photos and videos`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          Send {what}
        </Text>
        <View style={styles.grid}>
          {items?.map((item, index) => (
            <View key={item.uri} style={styles.tile}>
              <Image
                source={{ uri: item.uri }}
                style={styles.thumb}
                contentFit="cover"
                accessibilityLabel={`${item.type === 'video' ? 'Video' : 'Photo'} ${index + 1}`}
              />
              {item.type === 'video' ? (
                <Text style={styles.badge}>▶ {Math.round((item.durationMs ?? 0) / 1000)}s</Text>
              ) : null}
            </View>
          ))}
        </View>
        {pets.length > 1 ? (
          <MultiChoiceChips
            label="Who’s in it?"
            options={pets.map((p) => ({ value: p.id, label: p.name }))}
            value={petIds}
            onChange={setPetIds}
          />
        ) : null}
        <TextField
          label="Caption (optional)"
          value={caption}
          onChangeText={setCaption}
          placeholder="e.g. Zoomies in the yard"
          maxLength={200}
        />
        <Text style={styles.hint}>
          No signal? They’ll be saved on this phone and sent automatically.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <BigButton
          label={progress ?? `Send ${what}`}
          loading={progress !== null}
          onPress={() => onSend({ caption, petIds })}
        />
        <BigButton
          label="Cancel"
          variant="secondary"
          disabled={progress !== null}
          onPress={onCancel}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A1A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: 100, height: 100 },
  thumb: { width: 100, height: 100, borderRadius: 10, backgroundColor: '#EEEEEE' },
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 6,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  hint: { fontSize: 15, color: '#555555' },
  footer: { padding: 16, gap: 10 },
});
