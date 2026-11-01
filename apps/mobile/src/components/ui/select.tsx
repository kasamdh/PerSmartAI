import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { haptics, useTheme } from '@/theme';

import { BottomSheet } from './bottom-sheet';
import { FieldButton } from './field-button';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type SelectOption<T extends string> = { value: T; label: string; description?: string };

export type SelectProps<T extends string> = {
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
};

/** Pick one option from a list in a bottom sheet (big rows, one tap to choose). */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  error,
}: SelectProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <FieldButton
        label={label}
        value={selected?.label ?? ''}
        placeholder={placeholder}
        error={error}
        icon="chevronDown"
        onPress={() => setOpen(true)}
      />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <ScrollView contentContainerStyle={{ gap: theme.space.xxs }}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <PressableScale
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={
                  option.description ? `${option.label}. ${option.description}` : option.label
                }
                onPress={() => {
                  haptics.tap();
                  onChange(option.value);
                  setOpen(false);
                }}
                style={[
                  styles.row,
                  {
                    minHeight: theme.size.control,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.space.md,
                    gap: theme.space.sm,
                    backgroundColor: isSelected ? theme.colors.primarySoft : 'transparent',
                  },
                ]}
              >
                <View style={styles.flex}>
                  <Text variant="bodyStrong" tone={isSelected ? 'primary' : 'default'}>
                    {option.label}
                  </Text>
                  {option.description ? (
                    <Text variant="callout" tone="muted">
                      {option.description}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? <Icon name="done" color="primaryInk" /> : null}
              </PressableScale>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  flex: { flex: 1 },
});
