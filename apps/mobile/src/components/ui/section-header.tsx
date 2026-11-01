import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

/** A section title (a screen-reader heading), with an optional "See all" style link. */
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { marginTop: theme.space.xs }]}>
      <Text variant="subheading" accessibilityRole="header" style={styles.flex}>
        {title}
      </Text>
      {action ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${action.label}: ${title}`}
          onPress={action.onPress}
          style={[styles.action, { minHeight: theme.size.tap, paddingHorizontal: theme.space.xs }]}
        >
          <Text variant="label" tone="primary">
            {action.label}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  action: { justifyContent: 'center' },
});
