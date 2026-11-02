import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { TextField } from '@/components/text-field';

import type { IncidentSeverity } from './api';

const SEVERITIES = [
  { value: 'minor', label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
  { value: 'emergency', label: 'Emergency' },
] as const;

export type IncidentInput = {
  petId: string | null;
  severity: IncidentSeverity;
  description: string;
  photo: { uri: string; width: number } | null;
};

/** Report an incident: severity, what happened, an optional photo. */
export function IncidentSheet({
  visible,
  pets,
  saving,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  pets: { id: string; name: string }[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: IncidentInput) => void;
}) {
  const [petId, setPetId] = useState<string>(pets.length === 1 ? pets[0].id : 'none');
  const [severity, setSeverity] = useState<IncidentSeverity>('minor');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<IncidentInput['photo']>(null);
  const [error, setError] = useState<string | null>(null);

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to add a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setPhoto({ uri: asset.uri, width: asset.width });
  };

  const submit = () => {
    if (!description.trim()) {
      setError('Describe what happened');
      return;
    }
    setError(null);
    onSubmit({ petId: petId === 'none' ? null : petId, severity, description, photo });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} accessibilityRole="header">
            Report an incident
          </Text>
          <Text style={styles.body}>
            The business and the owner are notified right away. In an emergency, call the vet first.
          </Text>
          {pets.length > 1 ? (
            <ChoiceChips
              label="Which pet?"
              options={[
                ...pets.map((p) => ({ value: p.id, label: p.name })),
                { value: 'none', label: 'Not a pet' },
              ]}
              value={petId}
              onChange={setPetId}
            />
          ) : null}
          <ChoiceChips
            label="How serious?"
            options={SEVERITIES}
            value={severity}
            onChange={setSeverity}
          />
          <TextField
            label="What happened?"
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Rex cut his paw on the walk; cleaned it and kept him calm"
            multiline
            style={styles.multiline}
            maxLength={2000}
          />
          {photo ? (
            <Image
              source={{ uri: photo.uri }}
              style={styles.preview}
              accessibilityLabel="Incident photo"
            />
          ) : null}
          <BigButton
            label={photo ? 'Retake photo' : 'Add a photo'}
            variant="secondary"
            onPress={() => void takePhoto()}
            disabled={saving}
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <BigButton label="Send report" onPress={submit} loading={saving} />
          <BigButton label="Cancel" variant="secondary" onPress={onCancel} disabled={saving} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#B71C1C' },
  body: { fontSize: 16, color: '#444444' },
  multiline: { minHeight: 120, paddingTop: 14, textAlignVertical: 'top' },
  preview: { width: '100%', height: 200, borderRadius: 12 },
  error: { fontSize: 16, color: '#C62828' },
  footer: { padding: 16, gap: 10 },
});
