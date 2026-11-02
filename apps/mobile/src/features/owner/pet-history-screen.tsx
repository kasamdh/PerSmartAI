import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyView, ErrorView, LoadingView } from '@/components/query-states';
import { buildReportCard, reportCardLines } from '@/features/care/report-card';
import { formatDayAndTime } from '@/features/visits/time';

import { usePetVisitHistory } from './hooks';

/** One pet's past visits, newest first, each with what happened for that pet. */
export function PetHistoryScreen({ petId, petName }: { petId: string; petName: string }) {
  const router = useRouter();
  const history = usePetVisitHistory(petId);

  if (history.isPending) return <LoadingView label="Loading visit history" />;
  if (history.isError) return <ErrorView onRetry={() => history.refetch()} />;

  const now = new Date();
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching}
            onRefresh={() => void history.refetch()}
          />
        }
      >
        {history.data.length === 0 ? (
          <EmptyView title="No visits yet" body={`${petName}'s finished visits will show here.`} />
        ) : (
          history.data.map((v) => {
            const report = buildReportCard(v.care_events, [{ id: petId, name: petName }]).pets[0];
            const missed = v.status === 'missed';
            return (
              <Pressable
                key={v.id}
                accessibilityRole="button"
                accessibilityLabel={`Visit ${formatDayAndTime(v.scheduled_start, now)}`}
                onPress={() => router.push({ pathname: '/visits/[id]', params: { id: v.id } })}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <Text style={styles.when}>
                  {formatDayAndTime(v.check_in_at ?? v.scheduled_start, now)}
                </Text>
                <Text style={styles.body}>
                  {missed ? 'Missed' : (v.sitter?.full_name ?? 'Sitter')}
                </Text>
                {missed
                  ? null
                  : reportCardLines(report).map((line) => (
                      <Text key={line} style={styles.line}>
                        {line}
                      </Text>
                    ))}
                {v.summary_note ? (
                  <Text style={styles.note} numberOfLines={2}>
                    “{v.summary_note}”
                  </Text>
                ) : null}
                <View style={styles.more}>
                  <Text style={styles.link}>Report card ›</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 4,
    minHeight: 88,
  },
  pressed: { opacity: 0.75 },
  when: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  body: { fontSize: 16, color: '#555555' },
  line: { fontSize: 16, color: '#333333' },
  note: { fontSize: 15, color: '#555555', fontStyle: 'italic' },
  more: { marginTop: 4 },
  link: { fontSize: 15, fontWeight: '600', color: '#0B5CAD' },
});
