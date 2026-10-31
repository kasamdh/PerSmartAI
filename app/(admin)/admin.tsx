import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Screen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Admin dashboard' }} />
      <Text style={styles.text}>Admin dashboard: coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { fontSize: 22, textAlign: 'center' },
});
