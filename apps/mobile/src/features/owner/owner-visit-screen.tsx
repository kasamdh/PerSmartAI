import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { CareTimeline } from '@/features/care/care-timeline';
import { useCareEvents, useIncidents, useVisitPhotos } from '@/features/care/hooks';
import { PhotoGrid } from '@/features/care/photo-grid';
import { buildReportCard } from '@/features/care/report-card';
import { useProfile } from '@/features/auth/use-profile';
import { petRouteFor } from '@/features/pets/routes';
import { formatDayAndTime, formatTime } from '@/features/visits/time';

import { useOwnerVisit, useVisitLiveUpdates } from './hooks';
import { isActiveVisit, ownerStatusText } from './owner-visits';
import { ReportCardView } from './report-card-view';
import { VisitTimeline } from './visit-timeline';

/** Read-only, live view of one visit for the pet owner. */
export function OwnerVisitScreen({ visitId }: { visitId: string }) {
  const router = useRouter();
  const role = useProfile().data?.role;
  const visit = useOwnerVisit(visitId);
  const events = useCareEvents(visitId);
  const photos = useVisitPhotos(visitId);
  const incidents = useIncidents(visitId);
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
  const petList = v.booking.booking_pets.flatMap((bp) => (bp.pet ? [bp.pet] : []));
  const pets = petList.map((p) => p.name);
  const active = isActiveVisit(v.status);
  const done = v.status === 'completed';
  const card = done
    ? buildReportCard(
        (events.data ?? []).map((e) => ({ ...e, pet_id: e.pet_id ?? e.pet?.id ?? null })),
        petList,
      )
    : null;

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
          {active && v.status_line ? (
            <Text style={styles.statusLine} accessibilityLiveRegion="polite">
              “{v.status_line}”
            </Text>
          ) : null}
          {active ? <Text style={styles.live}>● Live: updates appear automatically</Text> : null}
        </View>

        <View style={styles.card}>
          <VisitTimeline visit={v} />
        </View>

        {card ? (
          <ReportCardView card={card} summary={v.summary_note} sitterName={sitterName} />
        ) : null}

        {(incidents.data ?? []).map((i) => (
          <View key={i.id} style={[styles.card, styles.incident]} accessibilityRole="alert">
            <Text style={styles.incidentTitle}>
              Incident ({i.severity}){i.pet ? ` · ${i.pet.name}` : ''} · {formatTime(i.created_at)}
            </Text>
            <Text style={styles.body}>{i.description}</Text>
          </View>
        ))}

        {role ? (
          <View style={styles.petLinks}>
            {petList.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}'s profile`}
                onPress={() => router.push(petRouteFor(role, p.id))}
                style={styles.petLink}
              >
                <Text style={styles.petLinkLabel}>{p.name}’s profile ›</Text>
              </Pressable>
            ))}
            {role === 'owner'
              ? petList.map((p) => (
                  <Pressable
                    key={`history-${p.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.name}'s visit history`}
                    onPress={() =>
                      router.push({ pathname: '/pets/[id]/history', params: { id: p.id } })
                    }
                    style={styles.petLink}
                  >
                    <Text style={styles.petLinkLabel}>{p.name}’s visits ›</Text>
                  </Pressable>
                ))
              : null}
            {role === 'owner'
              ? petList.map((p) => (
                  <Pressable
                    key={`gallery-${p.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.name}'s photos`}
                    onPress={() =>
                      router.push({ pathname: '/pets/[id]/gallery', params: { id: p.id } })
                    }
                    style={styles.petLink}
                  >
                    <Text style={styles.petLinkLabel}>{p.name}’s photos ›</Text>
                  </Pressable>
                ))
              : null}
          </View>
        ) : null}

        {v.summary_note && !card ? (
          <View style={styles.card}>
            <Text style={styles.title}>Visit summary</Text>
            <Text style={styles.body}>{v.summary_note}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.title}>Photos & videos</Text>
          <PhotoGrid
            photos={photos.data}
            isLoading={photos.isPending}
            canReact={role === 'owner'}
            visitId={visitId}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{active ? 'Live feed' : 'Care log'}</Text>
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
  petLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  petLink: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#E3F0FD',
    justifyContent: 'center',
  },
  petLinkLabel: { fontSize: 16, fontWeight: '600', color: '#0B5CAD' },
  statusLine: {
    fontSize: 19,
    fontWeight: '600',
    color: '#1B5E20',
  },
  incident: { borderColor: '#C62828', borderWidth: 2 },
  incidentTitle: { fontSize: 17, fontWeight: '700', color: '#B71C1C' },
  live: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 4,
  },
});
