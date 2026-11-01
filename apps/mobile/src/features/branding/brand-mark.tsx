import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { cachedImageSource } from '@/lib/image-cache';

import { useBrand } from './brand-context';

/** The business's logo and name, shown at the top of each home screen. */
export function BrandMark() {
  const { logoUrl, name, colors } = useBrand();
  if (!logoUrl && !name) return null;
  return (
    <View style={styles.row} accessible accessibilityLabel={name ?? 'Business logo'}>
      {logoUrl ? (
        <Image
          // The row is labelled with the business name.
          accessible={false}
          source={cachedImageSource(logoUrl)}
          cachePolicy="memory-disk"
          style={styles.logo}
          contentFit="contain"
        />
      ) : null}
      {name ? <Text style={[styles.name, { color: colors.accentOnWhite }]}>{name}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  logo: { width: 48, height: 48, borderRadius: 8 },
  name: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
});
