import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerShadowVisible: false,
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}
