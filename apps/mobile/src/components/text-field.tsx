import { useId, type ComponentRef, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { MIN_TAP_TARGET } from './big-button';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const errorId = useId();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        placeholderTextColor="#8A8A8A"
        style={[styles.input, !!error && styles.inputError, style]}
        {...rest}
      />
      {error ? (
        <Text nativeID={errorId} style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  input: {
    minHeight: MIN_TAP_TARGET,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#C62828',
  },
  error: {
    fontSize: 15,
    color: '#C62828',
  },
});
