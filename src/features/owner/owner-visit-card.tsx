import { Pressable, StyleSheet, Text, View } from 'react-native';

import { statusLabel } from '@/features/visits/visit-actions';

import type { OwnerVisit } from './api';
import { isActiveVisit, ownerStatusText } from './owner-visits';

const SERVICE_LABELS = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight',
  multi_day: 'Multi-day',
} as const;

export function OwnerVisitCard({ visit, onOpen }: { visit: OwnerVisit; onOpen: () => void }) {
  const sitterName = visit.sitter?.full_name.split(' ')[0] ?? null;
  const pets = visit.booking.booking_pets.map((bp) => bp.pet?.name).filter(Boolean);
  const active = isActiveVisit(visit.status);
  const status = ownerStatusText(visit, sitterName, new Date());

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${SERVICE_LABELS[visit.booking.service_type]} for ${pets.join(' and ')}. ${status}`}
      accessibilityHint="Opens the visit's care log and photos"
      onPress={onOpen}
      style={({ pressed }) => [styles.card, active && styles.cardActive, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <Text style={styles.service}>
          {SERVICE_LABELS[visit.booking.service_type]} · {pets.join(', ')}
        </Text>
        <Text style={[styles.badge, active && styles.badgeActive]}>
          {statusLabel(visit.status)}
        </Text>
      </View>
      <Text style={[styles.status, active && styles.statusActive]}>{status}</Text>
      {visit.summary_note ? (
        <Text style={styles.summary} numberOfLines={2}>
          “{visit.summary_note}”
        </Text>
      ) : null}
      <Text style={styles.open}>See care log and photos ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 96,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 6,
  },
  cardActive: {
    borderColor: '#2E7D32',
    borderWidth: 2,
    backgroundColor: '#F3FAF3',
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
  service: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
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
  badgeActive: {
    color: '#FFFFFF',
    backgroundColor: '#2E7D32',
  },
  status: {
    fontSize: 18,
    color: '#333333',
  },
  statusActive: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B5E20',
  },
  summary: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#444444',
  },
  open: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0B5CAD',
  },
});
