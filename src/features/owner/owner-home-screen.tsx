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
import { AccountButtons } from '@/features/auth/account-buttons';
import { useProfile } from '@/features/auth/use-profile';
import { usePets } from '@/features/pets/hooks';
import { PetCard } from '@/features/pets/pet-card';
import { petRouteFor } from '@/features/pets/routes';

import type { OwnerVisit } from './api';
import { useOwnerVisits, useOwnerVisitsLiveUpdates } from './hooks';
import { OwnerVisitCard } from './owner-visit-card';
import { partitionOwnerVisits } from './owner-visits';

export function OwnerHomeScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const visits = useOwnerVisits();
  const pets = usePets();
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            My pets
          </Text>
          {pets.isPending ? (
            <ActivityIndicator accessibilityLabel="Loading pets" />
          ) : pets.isError ? (
            <BigButton label="Couldn't load pets. Try again" onPress={() => pets.refetch()} />
          ) : pets.data.length === 0 ? (
            <Text style={styles.muted}>
              Add your pets so your sitter knows how to care for them.
            </Text>
          ) : (
            pets.data.map((p) => (
              <PetCard key={p.id} pet={p} onPress={() => router.push(petRouteFor('owner', p.id))} />
            ))
          )}
          <BigButton label="Add a pet" onPress={() => router.push('/pets/new')} />
          <BigButton
            label="Home & emergency contacts"
            variant="secondary"
            onPress={() => router.push('/household')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Bookings
          </Text>
          <BigButton label="Book a visit" onPress={() => router.push('/my-bookings/new')} />
          <BigButton
            label="My bookings"
            variant="secondary"
            onPress={() => router.push('/my-bookings')}
          />
        </View>

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
          <AccountButtons />
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
