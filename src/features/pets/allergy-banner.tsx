import { StyleSheet, Text, View } from 'react-native';

import { allergyBanner, type AllergySeverity } from './logic';

type AllergyBannerProps = {
  allergies: { allergen: string; severity: AllergySeverity; reaction_notes?: string | null }[];
};

/**
 * Red banner listing a pet's allergies. Rendered at the very top of every pet
 * detail view; there is deliberately no way to collapse or dismiss it.
 */
export function AllergyBanner({ allergies }: AllergyBannerProps) {
  const banner = allergyBanner(allergies);
  if (!banner) return null;

  return (
    <View
      style={styles.banner}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={banner.accessibilityLabel}
      testID="allergy-banner"
    >
      <Text style={styles.title}>⚠ ALLERGIES</Text>
      {banner.items.map((item) => (
        <Text key={item.allergen} style={[styles.item, item.emphasized && styles.severe]}>
          {item.allergen} · {item.severity.toUpperCase()}
          {item.notes ? <Text style={styles.notes}> · {item.notes}</Text> : null}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#C62828',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#FFFFFF',
  },
  item: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  severe: {
    fontWeight: '800',
  },
  notes: {
    fontWeight: '400',
  },
});
