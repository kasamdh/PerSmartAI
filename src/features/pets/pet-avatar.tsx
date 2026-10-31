import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { usePetPhotoUrl } from './hooks';

/** Pet photo from private storage, or a colored initial when there's none. */
export function PetAvatar({
  name,
  photoPath,
  size = 64,
}: {
  name: string;
  photoPath: string | null;
  size?: number;
}) {
  const url = usePetPhotoUrl(photoPath);
  const frame = { width: size, height: size, borderRadius: size / 2 };

  if (url.data) {
    return (
      <Image
        source={{ uri: url.data }}
        style={[styles.frame, frame]}
        contentFit="cover"
        accessibilityLabel={`Photo of ${name}`}
      />
    );
  }
  return (
    <View
      style={[styles.frame, styles.fallback, frame]}
      accessibilityLabel={`${name} has no photo`}
    >
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: '#EEF1F5', overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#D6E8FB' },
  initial: { fontWeight: '700', color: '#0B5CAD' },
});
