import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { compressImage, type CompressedImage } from '@/lib/images';

import { BigButton } from './big-button';

type PhotoPickerProps = {
  /** URL of the current photo (e.g. a signed URL), if any. */
  currentUrl?: string | null;
  /** Called with the compressed JPEG; the caller decides where to upload it. */
  onPicked: (image: CompressedImage) => void;
  /** Longest allowed width in px. Pet photos use 1080. */
  maxWidth?: number;
  label?: string;
};

/**
 * Take or choose a photo, compressed on-device before upload (smaller uploads on
 * mobile data). Shows the new photo immediately as a preview.
 */
export function PhotoPicker({
  currentUrl,
  onPicked,
  maxWidth = 1080,
  label = 'Photo',
}: PhotoPickerProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const pick = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access in Settings to take a photo.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: 'images',
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    setWorking(true);
    try {
      const image = await compressImage(asset.uri, asset.width, { maxWidth });
      setPreview(image.uri);
      onPicked(image);
    } catch {
      Alert.alert("Couldn't use that photo", 'Please try another one.');
    } finally {
      setWorking(false);
    }
  };

  const shown = preview ?? currentUrl ?? null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View style={styles.frame}>
          {working ? (
            <ActivityIndicator accessibilityLabel="Processing photo" />
          ) : shown ? (
            <Image
              source={{ uri: shown }}
              style={styles.image}
              contentFit="cover"
              accessibilityLabel="Selected photo"
            />
          ) : (
            <Text style={styles.placeholder}>No photo</Text>
          )}
        </View>
        <View style={styles.actions}>
          <BigButton
            label="Take photo"
            variant="secondary"
            onPress={() => void pick('camera')}
            disabled={working}
          />
          <BigButton
            label="Choose photo"
            variant="secondary"
            onPress={() => void pick('library')}
            disabled={working}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  frame: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#EEF1F5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { fontSize: 15, color: '#666666' },
  actions: { flex: 1, gap: 8 },
});
