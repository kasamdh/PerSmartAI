import { petAge } from '@petsitter/shared/pets';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import {
  AllergyBanner,
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  ListItem,
  Screen,
  SectionHeader,
  SkeletonList,
  StatusChip,
  Text,
} from '@/components/ui';
import { cachedImageSource } from '@/lib/image-cache';
import { useTheme, type VisitStatus } from '@/theme';

import { homeHeadline, visitPetNames, visitWhen } from './owner-home';

// The owner's home, drawn only from props, so the Design Preview can show it with
// sample data in light and dark. OwnerHomeScreen supplies the real data.

const SERVICE: Record<string, string> = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight',
  multi_day: 'Multi-day stay',
};

export type HomeVisit = {
  id: string;
  status: VisitStatus;
  scheduled_start: string;
  scheduled_end: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status_line: string | null;
  summary_note: string | null;
  sitter: { full_name: string } | null;
  booking: {
    service_type: string;
    booking_pets: { pet: { id: string; name: string; species: string } | null }[];
  };
};

export type HomePet = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  pet_allergies: {
    allergen: string;
    severity: 'mild' | 'moderate' | 'severe';
    reaction_notes?: string | null;
  }[];
};

type Loadable<T> =
  { state: 'loading' } | { state: 'error'; retry: () => void } | { state: 'ready'; data: T };

export type OwnerHomeViewProps = {
  firstName: string | null;
  business: { name: string | null; logoUrl: string | null };
  visits: Loadable<{ active: HomeVisit[]; upcoming: HomeVisit[]; recent: HomeVisit[] }>;
  pets: Loadable<HomePet[]>;
  unreadMessages: number;
  now: Date;
  refreshing: boolean;
  onRefresh: () => void;
  /** Pet photo (signed URL via a hook in the screen; a plain avatar in the preview). */
  renderPetAvatar: (pet: HomePet) => ReactNode;
  onOpenVisit: (visitId: string) => void;
  onOpenPet: (petId: string) => void;
  onAddPet: () => void;
  onBook: () => void;
  onAllBookings: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onHousehold: () => void;
  onNotifications: () => void;
  /** Asks, then signs out (OwnerHomeScreen uses confirmSignOut). */
  onSignOut: () => void;
};

export function OwnerHomeView(props: OwnerHomeViewProps) {
  const theme = useTheme();
  const { visits, pets, now } = props;
  const hasPets = pets.state === 'ready' && pets.data.length > 0;
  const groups = visits.state === 'ready' ? visits.data : null;

  return (
    <Screen
      edges={['top', 'left', 'right', 'bottom']}
      refreshing={props.refreshing}
      onRefresh={props.onRefresh}
      bottomAction={
        // One main action, in the thumb zone. Booking needs a pet first.
        pets.state === 'ready' && !hasPets ? (
          <Button label="Add your first pet" icon="plus" onPress={props.onAddPet} />
        ) : (
          <Button label="Book a visit" icon="plus" onPress={props.onBook} haptic="tap" />
        )
      }
    >
      {/* Greeting and what's happening, with Messages and Profile in reach. */}
      <View style={[styles.header, { gap: theme.space.sm }]}>
        <View style={[styles.flex, { gap: theme.space.xxs }]}>
          {props.business.name ? (
            <View style={[styles.row, { gap: theme.space.xs }]}>
              {props.business.logoUrl ? (
                <Image
                  source={cachedImageSource(props.business.logoUrl)}
                  cachePolicy="memory-disk"
                  style={{ width: 24, height: 24, borderRadius: 6 }}
                  accessible={false}
                />
              ) : null}
              <Text variant="caption" tone="muted">
                {props.business.name}
              </Text>
            </View>
          ) : null}
          <Text variant="title" accessibilityRole="header">
            {props.firstName ? `Hi, ${props.firstName}` : 'Welcome'}
          </Text>
          <Text variant="body" tone="muted">
            {groups ? homeHeadline(groups, now) : ' '}
          </Text>
        </View>
        <IconButton
          icon="chat"
          accessibilityLabel="Messages"
          badge={props.unreadMessages}
          onPress={props.onMessages}
        />
        <IconButton icon="user" accessibilityLabel="My profile" onPress={props.onProfile} />
      </View>

      {/* Happening now: the live visit, tinted and first. */}
      {groups?.active.map((visit) => (
        <Card
          key={visit.id}
          tone="primary"
          onPress={() => props.onOpenVisit(visit.id)}
          accessibilityLabel={`${SERVICE[visit.booking.service_type] ?? 'Visit'} with ${visitPetNames(visit)} happening now. ${visit.status_line ?? ''}`}
          accessibilityHint="Opens the live visit with photos and care log"
        >
          <View style={[styles.row, { gap: theme.space.xs }]}>
            <Text variant="label" tone="primary" style={styles.flex}>
              Happening now
            </Text>
            <StatusChip status={visit.status} />
          </View>
          <Text variant="heading">
            {SERVICE[visit.booking.service_type] ?? 'Visit'} with {visitPetNames(visit)}
          </Text>
          {visit.status_line ? <Text variant="body">“{visit.status_line}”</Text> : null}
          <View style={[styles.row, { gap: theme.space.xxs }]}>
            <Text variant="label" tone="primary">
              See photos and updates
            </Text>
            <Icon name="chevronRight" size="sm" color="primaryInk" />
          </View>
        </Card>
      ))}

      {/* My pets, with allergies always visible. */}
      <SectionHeader
        title="My pets"
        action={hasPets ? { label: 'Add a pet', onPress: props.onAddPet } : undefined}
      />
      {pets.state === 'loading' ? <SkeletonList rows={2} label="Loading your pets" /> : null}
      {pets.state === 'error' ? (
        <EmptyState
          icon="info"
          title="Couldn’t load your pets"
          body="Check your connection, then try again."
          action={{ label: 'Try again', onPress: pets.retry }}
        />
      ) : null}
      {pets.state === 'ready' && pets.data.length === 0 ? (
        <EmptyState
          icon="paw"
          title="Add your first pet"
          body="Tell your sitter about meals, medicines and what your pet loves."
        />
      ) : null}
      {pets.state === 'ready'
        ? pets.data.map((pet) => (
            <Card
              key={pet.id}
              onPress={() => props.onOpenPet(pet.id)}
              accessibilityLabel={`${pet.name}, ${[pet.breed, petAge(pet.birth_date, now)].filter(Boolean).join(', ')}`}
              accessibilityHint="Opens care details"
            >
              <View style={[styles.row, { gap: theme.space.sm }]}>
                {props.renderPetAvatar(pet)}
                <View style={styles.flex}>
                  <Text variant="subheading">{pet.name}</Text>
                  <Text variant="callout" tone="muted">
                    {[
                      pet.breed ?? (pet.species === 'cat' ? 'Cat' : 'Dog'),
                      petAge(pet.birth_date, now),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Icon name="chevronRight" color="textMuted" />
              </View>
              <AllergyBanner allergies={pet.pet_allergies} variant="compact" />
            </Card>
          ))
        : null}

      {/* Coming up. */}
      <SectionHeader
        title="Coming up"
        action={{ label: 'All bookings', onPress: props.onAllBookings }}
      />
      {visits.state === 'loading' ? <SkeletonList rows={2} label="Loading your visits" /> : null}
      {visits.state === 'error' ? (
        <EmptyState
          icon="info"
          title="Couldn’t load your visits"
          body="Check your connection, then try again."
          action={{ label: 'Try again', onPress: visits.retry }}
        />
      ) : null}
      {groups && groups.upcoming.length === 0 ? (
        <Text variant="body" tone="muted">
          Nothing booked yet. Tap “Book a visit” below when you need a sitter.
        </Text>
      ) : null}
      {groups && groups.upcoming.length > 0 ? (
        <Card padding="sm" elevation={1} style={styles.list}>
          {groups.upcoming.slice(0, 3).map((visit, i) => (
            <View key={visit.id}>
              {i > 0 ? (
                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
              ) : null}
              <ListItem
                title={`${SERVICE[visit.booking.service_type] ?? 'Visit'} · ${visitPetNames(visit)}`}
                subtitle={visitWhen(visit, now)}
                trailing={<StatusChip status={visit.status} />}
                onPress={() => props.onOpenVisit(visit.id)}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {/* Recent visits, with the sitter's note. */}
      {groups && groups.recent.length > 0 ? (
        <>
          <SectionHeader title="Recent visits" />
          <Card padding="sm" elevation={1} style={styles.list}>
            {groups.recent.slice(0, 3).map((visit, i) => (
              <View key={visit.id}>
                {i > 0 ? (
                  <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                ) : null}
                <ListItem
                  title={`${SERVICE[visit.booking.service_type] ?? 'Visit'} · ${visitPetNames(visit)}`}
                  subtitle={visit.summary_note ?? visitWhen(visit, now)}
                  trailing="chevron"
                  accessibilityHint="Opens the report card"
                  onPress={() => props.onOpenVisit(visit.id)}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* Less frequent places. */}
      <SectionHeader title="Home and account" />
      <Card padding="sm" elevation={1} style={styles.list}>
        <ListItem
          title="Home & emergency contacts"
          subtitle="Entry instructions, Wi-Fi, who to call"
          leading={<Icon name="home" color="primaryInk" />}
          trailing="chevron"
          onPress={props.onHousehold}
        />
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <ListItem
          title="Notifications"
          subtitle="Choose which updates you get"
          leading={<Icon name="bell" color="primaryInk" />}
          trailing="chevron"
          onPress={props.onNotifications}
        />
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <ListItem
          title="Sign out"
          leading={<Icon name="logout" color="danger" />}
          accessibilityHint="Asks before signing you out"
          onPress={props.onSignOut}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  list: { paddingHorizontal: 0, paddingVertical: 4, gap: 0, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
