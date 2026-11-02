import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { AccountButtons } from '@/features/auth/account-buttons';
import { BrandMark } from '@/features/branding/brand-mark';
import { useOrgTimeZone } from '@/features/scheduling/hooks';

import type { SitterVisit } from './api';
import { groupByDay } from './time';
import { useSitterVisits, useVisitActionRunner, type RunnableVisit } from './use-sitter-visits';
import { VisitCard } from './visit-card';

const runnable = (visit: SitterVisit): RunnableVisit => {
  const h = visit.booking.household;
  return {
    id: visit.id,
    placeName: h.name ?? h.address_line1,
    home: { lat: h.lat, lng: h.lng, address: h.address_line1 },
  };
};

export function SitterTodayScreen() {
  const visits = useSitterVisits();
  const router = useRouter();
  const openVisit = (id: string) => router.push({ pathname: '/visit/[id]', params: { id } });
  // Check-out happens on the visit screen, after medication tasks are done.
  const { run, pendingFor } = useVisitActionRunner({ onCheckOut: (v) => openVisit(v.id) });
  const timeZone = useOrgTimeZone();
  const sections = useMemo(() => groupByDay(visits.data ?? [], new Date()), [visits.data]);

  if (visits.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" accessibilityLabel="Loading your visits" />
      </View>
    );
  }

  if (visits.isError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{"Couldn't load your visits"}</Text>
          <Text style={styles.emptyBody}>Check your connection and try again.</Text>
        </View>
        <BigButton label="Try again" onPress={() => visits.refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <SectionList
        sections={sections}
        keyExtractor={(visit) => visit.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={<BrandMark />}
        refreshControl={
          <RefreshControl
            refreshing={visits.isRefetching}
            onRefresh={() => void visits.refetch()}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <VisitCard
            visit={item}
            pendingAction={pendingFor(item.id)}
            timeZone={timeZone}
            onAction={(action) => void run(runnable(item), action)}
            onOpen={() => openVisit(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No visits today</Text>
            <Text style={styles.emptyBody}>Your week is on the Week tab.</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <AccountButtons />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F4F7',
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 8,
    marginBottom: 10,
  },
  separator: {
    height: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 64,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 17,
    color: '#555555',
    textAlign: 'center',
  },
  footer: {
    marginTop: 32,
  },
});
