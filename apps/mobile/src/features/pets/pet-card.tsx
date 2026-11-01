import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PetListItem } from './api';
import { petAge } from './logic';
import { PetAvatar } from './pet-avatar';

/** Row in My Pets: photo, name, species, age, and an allergy warning. */
export function PetCard({ pet, onPress }: { pet: PetListItem; onPress: () => void }) {
  const age = petAge(pet.birth_date);
  const severe = pet.pet_allergies.some((a) => a.severity === 'severe');
  const allergyCount = pet.pet_allergies.length;
  const details = [pet.species === 'dog' ? 'Dog' : 'Cat', pet.breed, age]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pet.name}, ${details}${allergyCount ? `, ${allergyCount} allerg${allergyCount === 1 ? 'y' : 'ies'}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <PetAvatar name={pet.name} photoPath={pet.photo_url} size={64} />
      <View style={styles.text}>
        <Text style={styles.name}>{pet.name}</Text>
        <Text style={styles.details}>{details}</Text>
        {allergyCount ? (
          <Text style={[styles.allergy, severe && styles.severe]}>
            ⚠ {allergyCount} allerg{allergyCount === 1 ? 'y' : 'ies'}
            {severe ? ' (severe)' : ''}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 12,
  },
  pressed: { opacity: 0.75 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  details: { fontSize: 16, color: '#555555' },
  allergy: { fontSize: 15, fontWeight: '600', color: '#C62828' },
  severe: { fontWeight: '800' },
  chevron: { fontSize: 28, color: '#666666' },
});
