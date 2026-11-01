import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';
import { formatClock } from '@/features/bookings/booking-text';
import { PetAvatar } from '@/features/pets/pet-avatar';
import { mapsUrl, visitTaskCount } from '@/features/scheduling/calendar';
import { deviceTimeZone } from '@/lib/time-zone';

import type { SitterVisit } from './api';
import { formatTime, formatTimeRange } from './time';
import { primaryActionFor, statusLabel, type VisitActionKind } from './visit-actions';

type VisitCardProps = {
  visit: SitterVisit;
  onAction: (action: VisitActionKind) => void;
  /** The action currently being saved for this visit, if any. */
  pendingAction?: VisitActionKind | null;
  /** Opens the visit; makes the card's info area one large tap target. */
  onOpen?: () => void;
  /** The business's time zone, for feeding and medication times. */
  timeZone?: string;
};

export const SERVICE_LABELS = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight',
  multi_day: 'Multi-day',
} as const;

const WARNING = '⚠️';
const PIN = '\u{1F4CD}';

/** "Arrive 11:00 AM–1:00 PM", "Arrive 9:00 AM", "Arrive 7:00 PM · leave 8:00 AM". */
export function arrivalWindowText(booking: SitterVisit['booking']): string | null {
  if (!booking.window_start) return null;
  const arrive = formatClock(booking.window_start);
  if (!booking.window_end) return `Arrive ${arrive}`;
  return booking.service_type === 'overnight'
    ? `Arrive ${arrive} · leave ${formatClock(booking.window_end)}`
    : `Arrive ${arrive}–${formatClock(booking.window_end)}`;
}

export function VisitCard({
  visit,
  onAction,
  pendingAction = null,
  onOpen,
  timeZone = deviceTimeZone(),
}: VisitCardProps) {
  const household = visit.booking.household;
  const pets = visit.booking.booking_pets.map((bp) => bp.pet).filter((pet) => pet !== null);
  const primary = primaryActionFor(visit.status);
  const busy = pendingAction !== null;
  const done = visit.status === 'completed';

  const address = [household.address_line1, household.address_line2, household.city]
    .filter(Boolean)
    .join(', ');
  const allergic = pets.filter((p) => p.pet_allergies.length > 0);
  const severe = allergic.some((p) => p.pet_allergies.some((a) => a.severity === 'severe'));
  const tasks = visitTaskCount(visit, pets, timeZone, { hasCareTime: !!visit.care_time });
  const arrival = arrivalWindowText(visit.booking);

  const openMaps = () =>
    void Linking.openURL(
      mapsUrl({ address, lat: household.lat, lng: household.lng }, Platform.OS),
    ).catch(() => undefined);

  return (
    <View style={[styles.card, done && styles.cardDone]}>
      <Pressable
        disabled={!onOpen}
        onPress={onOpen}
        accessibilityRole={onOpen ? 'button' : undefined}
        accessibilityLabel={
          onOpen ? `Open visit at ${household.name ?? household.address_line1}` : undefined
        }
        accessibilityHint={onOpen ? 'Shows pet care details and the care log' : undefined}
        style={({ pressed }) => [styles.info, pressed && styles.pressed]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.time}>
            {formatTimeRange(visit.scheduled_start, visit.scheduled_end)}
          </Text>
          <Text style={[styles.badge, done && styles.badgeDone]}>{statusLabel(visit.status)}</Text>
        </View>

        <Text style={styles.service}>
          {[SERVICE_LABELS[visit.booking.service_type], visit.care_time?.label, arrival]
            .filter(Boolean)
            .join(' · ')}
        </Text>

        {pets.length > 0 ? (
          <View style={styles.petsRow}>
            <View style={styles.avatars}>
              {pets.map((p) => (
                <PetAvatar key={p.id} name={p.name} photoPath={p.photo_url} size={44} />
              ))}
            </View>
            <Text style={styles.pets}>{pets.map((p) => p.name).join(', ')}</Text>
          </View>
        ) : null}

        {allergic.length > 0 ? (
          <Text
            style={[styles.allergy, severe && styles.allergySevere]}
            accessibilityLabel={`Allergy warning. ${allergic
              .map(
                (p) =>
                  `${p.name}: ${p.pet_allergies.map((a) => `${a.allergen} (${a.severity})`).join(', ')}`,
              )
              .join('. ')}`}
          >
            {`${WARNING} `}
            {allergic
              .map((p) => `${p.name}: ${p.pet_allergies.map((a) => a.allergen).join(', ')}`)
              .join(' · ')}
          </Text>
        ) : null}

        <Text style={styles.household}>{household.name ?? household.address_line1}</Text>
        <Text style={styles.meta}>
          {tasks === 0 ? 'No timed tasks' : `${tasks} task${tasks === 1 ? '' : 's'}`}
        </Text>

        {visit.check_in_at ? (
          <Text style={styles.meta}>
            Checked in {formatTime(visit.check_in_at)}
            {visit.check_out_at ? ` · out ${formatTime(visit.check_out_at)}` : ''}
          </Text>
        ) : null}

        {onOpen ? <Text style={styles.openHint}>Tap for care details ›</Text> : null}
      </Pressable>

      <Pressable
        onPress={openMaps}
        accessibilityRole="link"
        accessibilityLabel={`Directions to ${address}`}
        accessibilityHint="Opens your maps app"
        style={({ pressed }) => [styles.addressButton, pressed && styles.pressed]}
      >
        <Text style={styles.address}>{`${PIN} ${address}`}</Text>
        <Text style={styles.addressHint}>Directions ›</Text>
      </Pressable>

      {primary ? (
        <View style={styles.actions}>
          <BigButton
            label={primary.label}
            onPress={() => onAction(primary.kind)}
            loading={pendingAction === primary.kind}
            disabled={busy}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 4,
  },
  cardDone: {
    backgroundColor: '#F6F6F6',
  },
  info: {
    gap: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  openHint: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0B5CAD',
    marginTop: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  time: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    flexShrink: 1,
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
  badgeDone: {
    color: '#2E7D32',
    backgroundColor: '#E6F4E7',
  },
  service: {
    fontSize: 16,
    color: '#444444',
  },
  petsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  avatars: {
    flexDirection: 'row',
    gap: 4,
  },
  pets: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    flexShrink: 1,
  },
  allergy: {
    fontSize: 16,
    color: '#B42318',
    backgroundColor: '#FEF3F2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    overflow: 'hidden',
  },
  allergySevere: {
    fontWeight: '800',
  },
  household: {
    fontSize: 19,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 4,
  },
  addressButton: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#EEF5FD',
  },
  address: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0B5CAD',
    flexShrink: 1,
  },
  addressHint: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0B5CAD',
  },
  meta: {
    fontSize: 15,
    color: '#555555',
    marginTop: 4,
  },
  actions: {
    gap: 10,
    marginTop: 12,
  },
});
