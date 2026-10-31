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
import { SignOutButton } from '@/features/auth/sign-out-button';

import type { SitterVisit } from './api';
import { groupByDay } from './time';
import { useSitterVisits, useVisitActionRunner } from './use-sitter-visits';
import { VisitCard } from './visit-card';

const placeName = (visit: SitterVisit) =>
  visit.booking.household.name ?? visit.booking.household.address_line1;

export function SitterTodayScreen() {
  const visits = useSitterVisits();
  const { run, pendingFor } = useVisitActionRunner();
  const router = useRouter();
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
            onAction={(action) => run({ id: item.id, placeName: placeName(item) }, action)}
            onOpen={() => router.push({ pathname: '/visit/[id]', params: { id: item.id } })}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No visits today or tomorrow</Text>
            <Text style={styles.emptyBody}>Pull down to refresh.</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <SignOutButton />
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
