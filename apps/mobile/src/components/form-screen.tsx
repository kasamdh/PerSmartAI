import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FormScreenProps = {
  title: string;
  subtitle?: string;
  /** Form-level error (e.g. from the server), shown above the fields. */
  error?: string | null;
  children: ReactNode;
  /** Secondary links under the form. */
  footer?: ReactNode;
};

/**
 * Layout for auth and account forms: heading on top, fields and the primary
 * action in the lower part of the screen for one-thumb use, keyboard-aware.
 */
export function FormScreen({ title, subtitle, error, children, footer }: FormScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.form}>
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            {children}
          </View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A large, link-styled button for secondary navigation ("Forgot password?"). */
export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.textButton, pressed && styles.textButtonPressed]}
    >
      <Text style={styles.textButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  hero: {
    flex: 1,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#555555',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  error: {
    fontSize: 16,
    color: '#C62828',
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    padding: 14,
  },
  footer: {
    marginTop: 16,
    gap: 4,
    alignItems: 'center',
  },
  textButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  textButtonPressed: {
    backgroundColor: '#E3F0FD',
  },
  textButtonLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0B5CAD',
  },
});
