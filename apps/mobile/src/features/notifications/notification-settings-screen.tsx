import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MIN_TAP_TARGET } from '@/components/big-button';
import { ErrorView, LoadingView } from '@/components/query-states';
import type { AppRole } from '@/types/models';

import { alertKindsFor, toggleMuted, useNotificationSettings } from './settings';

/** Turn each kind of alert on or off. Incidents are always on. */
export function NotificationSettingsScreen({ role }: { role: AppRole }) {
  const { query, save } = useNotificationSettings();

  if (query.isPending) return <LoadingView label="Loading notification settings" />;
  if (query.isError) return <ErrorView onRetry={() => query.refetch()} />;
  const muted = query.data;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Choose what this account gets push notifications for, on all your devices.
        </Text>
        {alertKindsFor(role).map((kind) => {
          const on = kind.locked || !muted.includes(kind.kind);
          return (
            <View key={kind.kind} style={styles.row}>
              <View style={styles.text}>
                <Text style={styles.label}>{kind.label}</Text>
                <Text style={styles.description}>{kind.description}</Text>
              </View>
              <Switch
                value={on}
                disabled={kind.locked || save.isPending}
                accessibilityLabel={kind.label}
                accessibilityHint={kind.locked ? 'Always on' : undefined}
                onValueChange={(next) =>
                  save.mutate(toggleMuted(muted, kind.kind, next), {
                    onError: () => Alert.alert('Couldn’t save', 'Please try again.'),
                  })
                }
              />
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 10 },
  intro: { fontSize: 16, color: '#444444', marginBottom: 4 },
  row: {
    minHeight: MIN_TAP_TARGET + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  description: { fontSize: 14, color: '#555555' },
});
