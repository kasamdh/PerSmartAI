import { allergyBanner, type AllergySeverity } from '@petsitter/shared/pets';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

export type AllergyBannerProps = {
  allergies:
    | { allergen: string; severity: AllergySeverity; reaction_notes?: string | null }[]
    | null
    | undefined;
  /**
   * full: the red banner at the top of every pet view (default).
   * compact: one tinted line for cards and lists, still always visible.
   */
  variant?: 'full' | 'compact';
};

/**
 * A pet's allergies, in the dedicated allergy red. Always shown, never behind a
 * tap: no dismiss, no collapse. Severe allergies come first, in extra-bold.
 * Renders nothing when the pet has no allergies.
 */
export function AllergyBanner({ allergies, variant = 'full' }: AllergyBannerProps) {
  const theme = useTheme();
  const banner = allergyBanner(allergies);
  if (!banner) return null;

  if (variant === 'compact') {
    return (
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={banner.accessibilityLabel}
        testID="allergy-banner"
        style={[
          styles.compact,
          {
            backgroundColor: theme.colors.allergySoft,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space.sm,
            gap: theme.space.xs,
          },
        ]}
      >
        <Icon name="alert" size="sm" color="allergy" />
        <Text variant="callout" tone="allergy" style={styles.flex}>
          {banner.items.map((item, i) => (
            <Text
              key={item.allergen}
              variant="callout"
              tone="allergy"
              style={item.emphasized ? styles.severe : undefined}
            >
              {i > 0 ? ', ' : ''}
              {item.allergen} ({item.severity})
            </Text>
          ))}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={banner.accessibilityLabel}
      testID="allergy-banner"
      style={{
        backgroundColor: theme.colors.allergy,
        borderRadius: theme.radius.lg,
        padding: theme.space.md,
        gap: theme.space.xxs,
      }}
    >
      <View style={[styles.row, { gap: theme.space.xs }]}>
        <Icon name="alert" color="onAllergy" />
        <Text variant="label" tone="onAllergy" style={styles.title}>
          ALLERGIES
        </Text>
      </View>
      {banner.items.map((item) => (
        <Text
          key={item.allergen}
          variant="body"
          tone="onAllergy"
          style={item.emphasized ? styles.severe : undefined}
        >
          {item.allergen} · {item.severity.toUpperCase()}
          {item.notes ? (
            <Text variant="body" tone="onAllergy" style={styles.notes}>
              {' '}
              · {item.notes}
            </Text>
          ) : null}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  compact: { flexDirection: 'row', alignItems: 'center', minHeight: 36, paddingVertical: 6 },
  flex: { flex: 1 },
  title: { letterSpacing: 1 },
  severe: { fontWeight: '800' },
  notes: { fontWeight: '400' },
});
