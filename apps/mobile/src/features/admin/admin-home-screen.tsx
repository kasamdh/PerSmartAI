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
import { MessagesButton } from '@/features/chat/messages-button';
import { AccountButtons } from '@/features/auth/account-buttons';
import { BrandMark } from '@/features/branding/brand-mark';
import { useProfile } from '@/features/auth/use-profile';
import { formatTimeRange } from '@/features/visits/time';
import { statusLabel } from '@/features/visits/visit-actions';

import { describeSchedule } from '@/features/bookings/booking-text';
import { useBookingRequests, useTodaysVisits } from './hooks';
import { ChangeRequestsSection, TimeOffRequestsSection } from './inbox-sections';
import { checkInTiming } from './live-board';

const SERVICE_LABELS = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight',
  multi_day: 'Multi-day',
} as const;

export function AdminHomeScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const requests = useBookingRequests();
  const today = useTodaysVisits();
  const firstName = profile?.full_name.split(' ')[0];

  const refreshing = requests.isRefetching || today.isRefetching;
  const onRefresh = () => {
    void requests.refetch();
    void today.refetch();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <BrandMark />
        <Text style={styles.greeting} accessibilityRole="header">
          {firstName ? `Hi, ${firstName}` : 'Dashboard'}
        </Text>
        <BigButton label="Live board" onPress={() => router.push('/live-board')} />
        <MessagesButton />
        <BigButton label="Calendar" variant="secondary" onPress={() => router.push('/schedule')} />
        <View style={styles.navRow}>
          <BigButton
            label="Workload"
            variant="secondary"
            style={styles.navButton}
            onPress={() => router.push('/workload')}
          />
          <BigButton
            label="Settings"
            variant="secondary"
            style={styles.navButton}
            onPress={() => router.push('/business-settings')}
          />
        </View>
        <BigButton
          label="Invite sitters and owners"
          variant="secondary"
          onPress={() => router.push('/invites')}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Booking requests{requests.data?.length ? ` (${requests.data.length})` : ''}
          </Text>
          {requests.isPending ? (
            <ActivityIndicator accessibilityLabel="Loading requests" />
          ) : requests.isError ? (
            <BigButton label="Couldn't load. Try again" onPress={() => requests.refetch()} />
          ) : requests.data.length === 0 ? (
            <Text style={styles.muted}>No requests waiting. Nice!</Text>
          ) : (
            requests.data.map((b) => {
              const pets = b.booking_pets
                .map((bp) => bp.pet?.name)
                .filter(Boolean)
                .join(', ');
              const place = b.household.name ?? b.household.address_line1;
              return (
                <Pressable
                  key={b.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Review ${SERVICE_LABELS[b.service_type]} request for ${place}`}
                  onPress={() => router.push({ pathname: '/bookings/[id]', params: { id: b.id } })}
                  style={({ pressed }) => [
                    styles.card,
                    styles.requestCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.cardTitle}>
                    {SERVICE_LABELS[b.service_type]} · {pets}
                  </Text>
                  <Text style={styles.body}>
                    {place} · {b.household.owner?.full_name}
                  </Text>
                  <Text style={styles.body}>{describeSchedule(b)}</Text>
                  <Text style={styles.link}>Assign a sitter ›</Text>
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Reschedule requests
          </Text>
          <ChangeRequestsSection />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Time off requests
          </Text>
          <TimeOffRequestsSection />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Today
          </Text>
          {today.isPending ? (
            <ActivityIndicator accessibilityLabel="Loading today's visits" />
          ) : today.isError ? (
            <BigButton label="Couldn't load. Try again" onPress={() => today.refetch()} />
          ) : today.data.length === 0 ? (
            <Text style={styles.muted}>No visits today.</Text>
          ) : (
            today.data.map((v) => {
              const place = v.booking.household.name ?? v.booking.household.address_line1;
              return (
                <Pressable
                  key={v.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Visit at ${place}, ${statusLabel(v.status)}`}
                  onPress={() =>
                    router.push({ pathname: '/manage-visit/[id]', params: { id: v.id } })
                  }
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <View style={styles.row}>
                    <Text style={styles.cardTitle}>
                      {formatTimeRange(v.scheduled_start, v.scheduled_end)}
                    </Text>
                    <Text style={styles.badge}>{statusLabel(v.status)}</Text>
                  </View>
                  <Text style={styles.body}>
                    {SERVICE_LABELS[v.booking.service_type]} · {place}
                  </Text>
                  <Text style={[styles.body, !v.sitter && styles.warning]}>
                    {v.sitter ? `Sitter: ${v.sitter.full_name}` : 'No sitter assigned'}
                  </Text>
                  {checkInTiming(v, new Date()).label ? (
                    <Text style={styles.warning}>{checkInTiming(v, new Date()).label}</Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>

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
  section: {
    gap: 10,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  card: {
    minHeight: 88,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 4,
  },
  requestCard: {
    borderColor: '#F0A202',
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.75,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flexShrink: 1,
  },
  body: {
    fontSize: 16,
    color: '#333333',
  },
  warning: {
    color: '#B71C1C',
    fontWeight: '600',
  },
  badge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B5CAD',
    backgroundColor: '#E3F0FD',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0B5CAD',
    marginTop: 4,
  },
  muted: {
    fontSize: 17,
    color: '#555555',
  },
  footer: {
    marginTop: 32,
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    flex: 1,
  },
});
