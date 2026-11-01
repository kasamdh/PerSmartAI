import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyView, ErrorView, LoadingView } from '@/components/query-states';
import { useAuth } from '@/features/auth/auth-provider';
import { formatDateLabel } from '@/lib/wall-clock';
import { usePetGallery, useSetHeart } from '@/features/care/hooks';
import { MediaTile } from '@/features/care/photo-grid';

import { groupByVisitDate } from './media-logic';
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

  if (gallery.isPending) return <LoadingView label={`Loading ${petName}'s photos`} />;
  if (gallery.isError) return <ErrorView onRetry={() => gallery.refetch()} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={gallery.isRefetching}
            onRefresh={() => void gallery.refetch()}
          />
        }
      >
        {ordered.length === 0 ? (
          <EmptyView
            title="No photos yet"
            body={`Photos and videos of ${petName} from visits show here.`}
          />
        ) : (
          groups.map((group) => (
            <View key={group.date} style={styles.group}>
              <Text style={styles.date} accessibilityRole="header">
                {formatDateLabel(group.date)}
              </Text>
              <View style={styles.grid}>
                {group.items.map((item) => {
                  const index = ordered.indexOf(item);
                  return (
                    <MediaTile
                      key={item.id}
                      item={item}
                      label={`Open ${item.type} from ${formatDateLabel(group.date)}`}
                      onPress={() => setOpen(index)}
                    />
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  content: { padding: 16, gap: 16 },
  group: { gap: 8 },
  date: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
