import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { CareTimeline } from '@/features/care/care-timeline';
import { useCareEvents, useVisitPhotos } from '@/features/care/hooks';
import { PhotoGrid } from '@/features/care/photo-grid';
import { formatDayAndTime, formatTime } from '@/features/visits/time';

import { useOwnerVisit, useVisitLiveUpdates } from './hooks';
import { isActiveVisit, ownerStatusText } from './owner-visits';

/** Read-only, live view of one visit for the pet owner. */
export function OwnerVisitScreen({ visitId }: { visitId: string }) {
  const visit = useOwnerVisit(visitId);
  const events = useCareEvents(visitId);
  const photos = useVisitPhotos(visitId);
  useVisitLiveUpdates(visitId);

  if (visit.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" accessibilityLabel="Loading visit" />
      </View>
    );
  }
  if (visit.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{"Couldn't load this visit"}</Text>
        <BigButton label="Try again" onPress={() => visit.refetch()} />
      </View>
    );
  }

  const v = visit.data;
  const now = new Date();
  const sitterName = v.sitter?.full_name.split(' ')[0] ?? null;
  const pets = v.booking.booking_pets.map((bp) => bp.pet?.name).filter(Boolean);
  const active = isActiveVisit(v.status);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={visit.isRefetching}
            onRefresh={() => {
              void visit.refetch();
              void events.refetch();
              void photos.refetch();
            }}
          />
        }
      >
        <View style={[styles.card, active && styles.cardActive]}>
          <Text
            style={[styles.status, active && styles.statusActive]}
            accessibilityLiveRegion="polite"
          >
            {ownerStatusText(v, sitterName, now)}
          </Text>
          <Text style={styles.body}>
            {pets.join(' & ')} · {formatDayAndTime(v.scheduled_start, now)}
          </Text>
          {v.sitter ? <Text style={styles.body}>Sitter: {v.sitter.full_name}</Text> : null}
          {v.check_in_at ? (
            <Text style={styles.body}>
              Checked in {formatTime(v.check_in_at)}
              {v.check_out_at ? ` · checked out ${formatTime(v.check_out_at)}` : ''}
            </Text>
          ) : null}
          {active ? <Text style={styles.live}>● Live: updates appear automatically</Text> : null}
        </View>

        {v.summary_note ? (
          <View style={styles.card}>
            <Text style={styles.title}>Visit summary</Text>
            <Text style={styles.body}>{v.summary_note}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.title}>Photos</Text>
          <PhotoGrid photos={photos.data} isLoading={photos.isPending} />
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Care log</Text>
          <CareTimeline events={events.data ?? []} canRemove={() => false} onRemove={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F4F7',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 6,
  },
  cardActive: {
    borderColor: '#2E7D32',
    borderWidth: 2,
    backgroundColor: '#F3FAF3',
  },
  status: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statusActive: {
    color: '#1B5E20',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  body: {
    fontSize: 17,
    color: '#333333',
  },
  live: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 4,
  },
});
