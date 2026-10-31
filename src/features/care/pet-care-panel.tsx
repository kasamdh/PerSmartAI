import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TAP_TARGET } from '@/components/big-button';

import type { VisitPet } from './api';
import { careButtonsFor, type CareEventType } from './care-events';

type PetCarePanelProps = {
  pet: VisitPet;
  /** Null hides the care buttons (not checked in, or already checked out). */
  onLog: ((type: Exclude<CareEventType, 'note'>) => void) | null;
  busy?: boolean;
};

function formatTimes(times: string[]): string {
  return times.map((t) => t.slice(0, 5)).join(', ');
}

export function PetCarePanel({ pet, onLog, busy = false }: PetCarePanelProps) {
  const buttons = careButtonsFor(pet.species, pet.pet_medications.length > 0);

  return (
    <View style={styles.panel}>
      <Text style={styles.name} accessibilityRole="header">
        {pet.name}
        <Text style={styles.breed}>
          {'  '}
          {[pet.species, pet.breed].filter(Boolean).join(' · ')}
        </Text>
      </Text>

      {pet.pet_allergies.map((a) => (
        <Text key={a.id} style={[styles.allergy, a.severity === 'severe' && styles.allergySevere]}>
          ⚠ Allergy: {a.allergen} ({a.severity}){a.reaction_notes ? ` · ${a.reaction_notes}` : ''}
        </Text>
      ))}

      {pet.feeding_plans.map((f) => (
        <Text key={f.id} style={styles.detail}>
          🍽 {[f.amount, f.unit].filter(Boolean).join(' ')} {f.food_brand ?? ''}
          {f.times.length ? ` at ${formatTimes(f.times)}` : ''}
          {f.treats_allowed ? '' : ' · no treats'}
          {f.notes ? ` · ${f.notes}` : ''}
        </Text>
      ))}

      {pet.pet_medications.map((m) => (
        <Text key={m.id} style={styles.detail}>
          💊 {m.name}
          {m.dose ? ` ${m.dose}` : ''}
          {m.schedule_times.length ? ` at ${formatTimes(m.schedule_times)}` : ''}
          {m.instructions ? ` · ${m.instructions}` : ''}
        </Text>
      ))}

      {pet.temperament_notes ? <Text style={styles.detail}>{pet.temperament_notes}</Text> : null}

      {onLog ? (
        <View style={styles.grid}>
          {buttons.map((b) => (
            <Pressable
              key={b.type}
              accessibilityRole="button"
              accessibilityLabel={`${b.label}, ${pet.name}`}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => onLog(b.type)}
              style={({ pressed }) => [
                styles.careButton,
                pressed && styles.careButtonPressed,
                busy && styles.careButtonBusy,
              ]}
            >
              <Text style={styles.careLabel}>{b.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  breed: {
    fontSize: 16,
    fontWeight: '400',
    color: '#555555',
  },
  allergy: {
    fontSize: 16,
    color: '#8A4B00',
    backgroundColor: '#FFF4E5',
    borderRadius: 10,
    padding: 8,
  },
  allergySevere: {
    color: '#B71C1C',
    backgroundColor: '#FDECEA',
    fontWeight: '600',
  },
  detail: {
    fontSize: 16,
    color: '#333333',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  careButton: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: MIN_TAP_TARGET,
    borderRadius: 14,
    backgroundColor: '#E3F0FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  careButtonPressed: {
    backgroundColor: '#C7E0FA',
  },
  careButtonBusy: {
    opacity: 0.6,
  },
  careLabel: {
    fontSize: 19,
    fontWeight: '600',
    color: '#0B5CAD',
  },
});
