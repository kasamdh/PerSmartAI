import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BigButton } from './big-button';

export function LoadingView({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" accessibilityLabel={label} />
    </View>
  );
}

export function ErrorView({
  title = "Couldn't load this",
  onRetry,
}: {
  title?: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.title} accessibilityRole="alert">
        {title}
      </Text>
      <Text style={styles.body}>Check your connection and try again.</Text>
      <BigButton label="Try again" onPress={onRetry} style={styles.button} />
    </View>
  );
}

export function EmptyView({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: '#F2F4F7',
  },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  body: { fontSize: 16, color: '#555555', textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
