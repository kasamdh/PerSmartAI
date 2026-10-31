import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';

import type { SitterVisit } from './api';
import { formatTime, formatTimeRange } from './time';
import {
  primaryActionFor,
  secondaryActionFor,
  statusLabel,
  type VisitActionKind,
} from './visit-actions';

type VisitCardProps = {
  visit: SitterVisit;
  onAction: (action: VisitActionKind) => void;
  /** The action currently being saved for this visit, if any. */
  pendingAction?: VisitActionKind | null;
  /** Opens the visit; makes the card's info area one large tap target. */
  onOpen?: () => void;
};

const SERVICE_LABELS = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight',
  multi_day: 'Multi-day',
} as const;

export function VisitCard({ visit, onAction, pendingAction = null, onOpen }: VisitCardProps) {
  const household = visit.booking.household;
  const pets = visit.booking.booking_pets.map((bp) => bp.pet).filter((pet) => pet !== null);
  const primary = primaryActionFor(visit.status);
  const secondary = secondaryActionFor(visit.status);
  const busy = pendingAction !== null;
  const done = visit.status === 'completed';

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
        style={({ pressed }) => [styles.info, pressed && styles.infoPressed]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.time}>
            {formatTimeRange(visit.scheduled_start, visit.scheduled_end)}
          </Text>
          <Text style={[styles.badge, done && styles.badgeDone]}>{statusLabel(visit.status)}</Text>
        </View>

        <Text style={styles.service}>{SERVICE_LABELS[visit.booking.service_type]}</Text>
        <Text style={styles.household}>{household.name ?? household.address_line1}</Text>
        <Text style={styles.address}>
          {[household.address_line1, household.address_line2, household.city]
            .filter(Boolean)
            .join(', ')}
        </Text>
        {pets.length > 0 ? (
          <Text style={styles.pets}>{pets.map((p) => `${p.name} (${p.species})`).join(' · ')}</Text>
        ) : null}

        {visit.check_in_at ? (
          <Text style={styles.meta}>
            Checked in {formatTime(visit.check_in_at)}
            {visit.check_out_at ? ` · out ${formatTime(visit.check_out_at)}` : ''}
          </Text>
        ) : null}

        {onOpen ? <Text style={styles.openHint}>Tap for care details ›</Text> : null}
      </Pressable>

      {primary || secondary ? (
        <View style={styles.actions}>
          {secondary ? (
            <BigButton
              label={secondary.label}
              variant="secondary"
              onPress={() => onAction(secondary.kind)}
              loading={pendingAction === secondary.kind}
              disabled={busy}
            />
          ) : null}
          {primary ? (
            <BigButton
              label={primary.label}
              onPress={() => onAction(primary.kind)}
              loading={pendingAction === primary.kind}
              disabled={busy}
            />
          ) : null}
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
  infoPressed: {
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
    fontSize: 15,
    color: '#555555',
  },
  household: {
    fontSize: 19,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 4,
  },
  address: {
    fontSize: 16,
    color: '#444444',
  },
  pets: {
    fontSize: 17,
    color: '#1A1A1A',
    marginTop: 4,
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
