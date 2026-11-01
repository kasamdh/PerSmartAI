import { useId, useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

export type TextFieldProps = TextInputProps & {
  label: string;
  /** Helpful text under the field (hidden while there's an error). */
  hint?: string;
  /** Shown right under the field, in red with an icon, and read by screen readers. */
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

/** A labelled text input, 56 pt tall, with the error next to the field. */
export function TextField({ label, hint, error, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const errorId = useId();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={{ gap: theme.space.xxs + 2 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        placeholderTextColor={theme.colors.textMuted}
        maxFontSizeMultiplier={theme.type.body.maxScale}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            minHeight: theme.size.control,
            borderColor,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space.md,
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            fontSize: theme.type.body.fontSize,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <View style={[styles.row, { gap: theme.space.xxs }]}>
          <Icon name="info" size="sm" color="danger" />
          <Text
            nativeID={errorId}
            variant="callout"
            tone="danger"
            accessibilityLiveRegion="polite"
            style={styles.flex}
          >
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="callout" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 2, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
