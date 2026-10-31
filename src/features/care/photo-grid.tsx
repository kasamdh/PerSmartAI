import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';

import type { VisitPhoto } from './api';

type PhotoGridProps = {
  photos: VisitPhoto[] | undefined;
  isLoading: boolean;
};

/** Thumbnails that open full-size in a viewer. */
export function PhotoGrid({ photos, isLoading }: PhotoGridProps) {
  const [open, setOpen] = useState<VisitPhoto | null>(null);

  if (!photos || photos.length === 0) {
    return <Text style={styles.empty}>{isLoading ? 'Loading…' : 'No photos yet.'}</Text>;
  }

  return (
    <>
      <View style={styles.grid}>
        {photos.map((photo, index) =>
          photo.thumbUrl ? (
            <Pressable
              key={photo.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Open photo ${index + 1} of ${photos.length}`}
              onPress={() => setOpen(photo)}
            >
              <Image source={{ uri: photo.thumbUrl }} style={styles.thumb} contentFit="cover" />
            </Pressable>
          ) : null,
        )}
      </View>

      <Modal
        visible={open !== null}
        animationType="fade"
        onRequestClose={() => setOpen(null)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <SafeAreaView style={styles.viewer}>
          {open?.url ? (
            <Image
              source={{ uri: open.url }}
              placeholder={open.thumbUrl ? { uri: open.thumbUrl } : undefined}
              style={styles.full}
              contentFit="contain"
              accessibilityLabel="Visit photo"
            />
          ) : null}
          <View style={styles.viewerActions}>
            <BigButton label="Close" variant="secondary" onPress={() => setOpen(null)} />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#EEEEEE',
  },
  empty: {
    fontSize: 16,
    color: '#333333',
  },
  viewer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  full: {
    flex: 1,
  },
  viewerActions: {
    padding: 16,
  },
});
