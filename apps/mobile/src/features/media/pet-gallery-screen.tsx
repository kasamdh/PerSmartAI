import { useMemo, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { Alert, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyView, ErrorView, LoadingView } from '@/components/query-states';
import { useAuth } from '@/features/auth/auth-provider';
import { formatDateLabel } from '@/lib/wall-clock';
import { usePetGallery, useSetHeart } from '@/features/care/hooks';
import { MediaTile } from '@/features/care/photo-grid';

import { galleryRows, groupByVisitDate, tilesPerRow } from './media-logic';
import { MediaViewer } from './media-viewer';

/** Every photo and video of one pet, grouped by visit date, newest first. */
export function PetGalleryScreen({ petId, petName }: { petId: string; petName: string }) {
  const gallery = usePetGallery(petId);
  const viewerId = useAuth().session?.user.id ?? null;
  const heart = useSetHeart(null);
  const [open, setOpen] = useState<number | null>(null);

  const items = useMemo(() => gallery.data ?? [], [gallery.data]);
  const groups = useMemo(() => groupByVisitDate(items), [items]);
  // The viewer pages through everything in display order.
  const ordered = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const perRow = tilesPerRow(useWindowDimensions().width);
  const rows = useMemo(() => galleryRows(groups, perRow), [groups, perRow]);

  if (gallery.isPending) return <LoadingView label={`Loading ${petName}'s photos`} />;
  if (gallery.isError) return <ErrorView onRetry={() => gallery.refetch()} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <FlashList
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.kind}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={gallery.isRefetching}
            onRefresh={() => void gallery.refetch()}
          />
        }
        ListEmptyComponent={
          <EmptyView
            title="No photos yet"
            body={`Photos and videos of ${petName} from visits show here.`}
          />
        }
        renderItem={({ item: row }) =>
          row.kind === 'header' ? (
            <Text style={styles.date} accessibilityRole="header">
              {formatDateLabel(row.date)}
            </Text>
          ) : (
            <View style={styles.row}>
              {row.tiles.map(({ item, index }) => (
                <MediaTile
                  key={item.id}
                  item={item}
                  label={`Open ${item.type} from ${formatDateLabel(row.date)}`}
                  onPress={() => setOpen(index)}
                />
              ))}
            </View>
          )
        }
      />
      <MediaViewer
        items={ordered}
        index={open}
        viewerId={viewerId}
        canReact
        onChangeIndex={setOpen}
        onClose={() => setOpen(null)}
        onToggleHeart={(item, hearted) =>
          heart.mutate(
            { mediaId: item.id, hearted },
            { onError: () => Alert.alert('Couldn’t save your heart', 'Please try again.') },
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16 },
  date: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginTop: 8, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
});
