import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { MediaViewer } from '@/features/media/media-viewer';
import { cachedImageSource } from '@/lib/image-cache';

import type { VisitPhoto } from './api';
import { useSetHeart } from './hooks';

type PhotoGridProps = {
  photos: VisitPhoto[] | undefined;
  isLoading: boolean;
  /** Owners can heart; everyone else sees the count. */
  canReact?: boolean;
  /** The visit the photos belong to (for refreshing after a heart); null for galleries. */
  visitId?: string | null;
};

/** Thumbnails (signed, short-lived); tap for the full photo or video. */
export function PhotoGrid({ photos, isLoading, canReact = false, visitId = null }: PhotoGridProps) {
  const [open, setOpen] = useState<number | null>(null);
  const viewerId = useAuth().session?.user.id ?? null;
  const heart = useSetHeart(visitId);

  if (!photos || photos.length === 0) {
    return <Text style={styles.empty}>{isLoading ? 'Loading…' : 'No photos yet.'}</Text>;
  }

  return (
    <>
      <View style={styles.grid}>
        {photos.map((photo, index) => (
          <MediaTile
            key={photo.id}
            item={photo}
            label={`Open ${photo.type === 'video' ? 'video' : 'photo'} ${index + 1} of ${photos.length}`}
            onPress={() => setOpen(index)}
          />
        ))}
      </View>
      <MediaViewer
        items={photos}
        index={open}
        viewerId={viewerId}
        canReact={canReact}
        onChangeIndex={setOpen}
        onClose={() => setOpen(null)}
        onToggleHeart={(item, hearted) =>
          heart.mutate(
            { mediaId: item.id, hearted },
            { onError: () => Alert.alert('Couldn’t save your heart', 'Please try again.') },
          )
        }
      />
    </>
  );
}

export function MediaTile({
  item,
  label,
  onPress,
}: {
  item: Pick<VisitPhoto, 'type' | 'thumbUrl' | 'duration_seconds' | 'hearts'>;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={label} onPress={onPress}>
      {item.thumbUrl ? (
        <Image
          source={cachedImageSource(item.thumbUrl)}
          cachePolicy="memory-disk"
          style={styles.thumb}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.thumb, styles.noThumb]} />
      )}
      {item.type === 'video' ? (
        <Text style={styles.videoBadge}>▶ {Math.round(item.duration_seconds ?? 0)}s</Text>
      ) : null}
      {item.hearts > 0 ? <Text style={styles.heartBadge}>♥ {item.hearts}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 96, height: 96, borderRadius: 10, backgroundColor: '#EEEEEE' },
  noThumb: { backgroundColor: '#333333' },
  videoBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 5,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  heartBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    color: '#FFFFFF',
    backgroundColor: 'rgba(233,30,99,0.85)',
    borderRadius: 6,
    paddingHorizontal: 5,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  empty: { fontSize: 16, color: '#333333' },
});
