import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { ErrorView, LoadingView } from '@/components/query-states';
import { useOrgSettings, type OrgSettings } from '@/features/scheduling/hooks';

import { useSaveOrgSettings } from './schedule-hooks';

const BUFFERS = ['0', '10', '15', '20', '30', '45', '60'];
const CUTOFFS = ['0', '12', '24', '48', '72'];
const RETENTION = [
  { value: 'keep', label: 'Keep' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
  { value: '24', label: '2 years' },
];

const withCurrent = (values: string[], current: number, unit: string) =>
  [...new Set([...values, String(current)])]
    .sort((a, b) => Number(a) - Number(b))
    .map((v) => ({ value: v, label: v === '0' ? 'None' : `${v} ${unit}` }));

/** Scheduling rules for the business: travel time between visits, cancellation cutoff. */
export function BusinessSettingsScreen() {
  const org = useOrgSettings();
  if (org.isPending) return <LoadingView />;
  if (org.isError || !org.data) return <ErrorView onRetry={() => org.refetch()} />;
  return <SettingsForm key={org.data.id} org={org.data} />;
}

function SettingsForm({ org }: { org: OrgSettings }) {
  const save = useSaveOrgSettings();
  const [buffer, setBuffer] = useState(String(org.travelBufferMinutes));
  const [cutoff, setCutoff] = useState(String(org.cancellationCutoffHours));
  const [retention, setRetention] = useState(
    org.mediaRetentionMonths ? String(org.mediaRetentionMonths) : 'keep',
  );

  const onSave = () =>
    save.mutate(
      {
        id: org.id,
        travelBufferMinutes: Number(buffer),
        cancellationCutoffHours: Number(cutoff),
        mediaRetentionMonths: retention === 'keep' ? null : Number(retention),
      },
      {
        onSuccess: () => Alert.alert('Saved', 'New bookings and changes use these settings.'),
        onError: (e) => Alert.alert('Couldn’t save', e.message || 'Please try again.'),
      },
    );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Travel time between visits</Text>
          <Text style={styles.body}>
            A sitter can’t be booked at two homes closer together than this. Visits at the same home
            need none.
          </Text>
          <ChoiceChips
            options={withCurrent(BUFFERS, org.travelBufferMinutes, 'min')}
            value={buffer}
            onChange={setBuffer}
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Late cancellation cutoff</Text>
          <Text style={styles.body}>
            Cancelling a booking less than this long before a visit marks it as a late cancellation.
            Owners are warned before they cancel.
          </Text>
          <ChoiceChips
            options={withCurrent(CUTOFFS, org.cancellationCutoffHours, 'hours')}
            value={cutoff}
            onChange={setCutoff}
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Delete old photos and videos</Text>
          <Text style={styles.body}>
            Saves storage costs. Visit photos and videos older than this are deleted every night;
            owners can save favorites to their phones first.
          </Text>
          <ChoiceChips
            options={
              RETENTION.some((r) => r.value === retention)
                ? RETENTION
                : [...RETENTION, { value: retention, label: `${retention} months` }]
            }
            value={retention}
            onChange={setRetention}
          />
        </View>
        <Text style={styles.body}>Time zone: {org.timeZone.replace(/_/g, ' ')}</Text>
      </ScrollView>
      <View style={styles.footer}>
        <BigButton label="Save settings" onPress={onSave} loading={save.isPending} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 10 },
  title: { fontSize: 19, fontWeight: '700', color: '#1A1A1A' },
  body: { fontSize: 16, color: '#444444' },
  footer: { padding: 16, paddingTop: 8 },
});
