import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { TextField } from '@/components/text-field';

import { appendPhrase, SUMMARY_MAX_LENGTH, SUMMARY_PHRASES } from './visit-actions';

type CheckOutSheetProps = {
  /** Where the visit is, e.g. "Rudra's home". Null hides the sheet. */
  placeName: string | null;
  onCancel: () => void;
  onConfirm: (summary: string) => void;
};

/** Confirms check-out and collects a short summary for the owner. */
export function CheckOutSheet({ placeName, onCancel, onConfirm }: CheckOutSheetProps) {
  const [summary, setSummary] = useState('');

  const close = () => {
    setSummary('');
    onCancel();
  };
  const confirm = () => {
    const text = summary;
    setSummary('');
    onConfirm(text);
  };

  return (
    <Modal visible={placeName !== null} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <Text style={styles.title} accessibilityRole="header">
                Check out of {placeName}?
              </Text>
              <Text style={styles.subtitle}>Add a quick note for the owner (optional).</Text>

              <View style={styles.chips}>
                {SUMMARY_PHRASES.map((phrase) => (
                  <Pressable
                    key={phrase}
                    accessibilityRole="button"
                    accessibilityLabel={`Add: ${phrase}`}
                    onPress={() =>
                      setSummary((s) => appendPhrase(s, phrase).slice(0, SUMMARY_MAX_LENGTH))
                    }
                    style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                  >
                    <Text style={styles.chipLabel}>{phrase}</Text>
                  </Pressable>
                ))}
              </View>

              <TextField
                label="How did it go?"
                value={summary}
                onChangeText={setSummary}
                multiline
                maxLength={SUMMARY_MAX_LENGTH}
                placeholder="e.g. Biscuit ate everything and we had a great walk."
                style={styles.input}
              />
            </ScrollView>

            <View style={styles.actions}>
              <BigButton label="Check out" onPress={confirm} />
              <BigButton label="Not yet" variant="secondary" onPress={close} />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  content: {
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 16,
    color: '#555555',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#E3F0FD',
    justifyContent: 'center',
  },
  chipPressed: {
    backgroundColor: '#C7E0FA',
  },
  chipLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0B5CAD',
  },
  input: {
    minHeight: 96,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  actions: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
});
