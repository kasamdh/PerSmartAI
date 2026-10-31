import { useRouter } from 'expo-router';
import { useMemo } from 'react';
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
import { SignOutButton } from '@/features/auth/sign-out-button';
import { useProfile } from '@/features/auth/use-profile';

import type { OwnerVisit } from './api';
import { useOwnerPets, useOwnerVisits, useOwnerVisitsLiveUpdates } from './hooks';
import { OwnerVisitCard } from './owner-visit-card';
import { partitionOwnerVisits } from './owner-visits';

export function OwnerHomeScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const visits = useOwnerVisits();
  const pets = useOwnerPets();
  useOwnerVisitsLiveUpdates();

  const groups = useMemo(() => partitionOwnerVisits(visits.data ?? [], new Date()), [visits.data]);
  const firstName = profile?.full_name.split(' ')[0];
  const open = (visit: OwnerVisit) =>
    router.push({ pathname: '/visits/[id]', params: { id: visit.id } });

  const section = (title: string, list: OwnerVisit[], empty?: string) =>
    list.length > 0 || empty ? (
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {list.length === 0 && empty ? <Text style={styles.muted}>{empty}</Text> : null}
        {list.map((v) => (
          <OwnerVisitCard key={v.id} visit={v} onOpen={() => open(v)} />
        ))}
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={visits.isRefetching}
            onRefresh={() => {
              void visits.refetch();
              void pets.refetch();
            }}
          />
        }
      >
        <Text style={styles.greeting} accessibilityRole="header">
          {firstName ? `Hi, ${firstName}` : 'Welcome'}
        </Text>

        {pets.data && pets.data.length > 0 ? (
          <Text style={styles.pets}>
            {pets.data.map((p) => `${p.name} (${p.species})`).join(' · ')}
          </Text>
        ) : null}

        {visits.isPending ? (
          <ActivityIndicator
            size="large"
            accessibilityLabel="Loading visits"
            style={styles.loading}
          />
        ) : visits.isError ? (
          <View style={styles.section}>
            <Text style={styles.muted}>{"Couldn't load your visits."}</Text>
            <BigButton label="Try again" onPress={() => visits.refetch()} />
          </View>
        ) : (
          <>
            {section('Happening now', groups.active)}
            {section('Upcoming', groups.upcoming, 'No upcoming visits.')}
            {section('Recent', groups.recent)}
          </>
        )}

        <View style={styles.footer}>
          <SignOutButton />
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
    gap: 8,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  pets: {
    fontSize: 17,
    color: '#444444',
  },
  loading: {
    marginTop: 48,
  },
  section: {
    gap: 10,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  muted: {
    fontSize: 17,
    color: '#555555',
  },
  footer: {
    marginTop: 32,
  },
});
