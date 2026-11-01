import { Tabs } from 'expo-router/js-tabs';

// Big labels and a tall bar: sitters tap these one-handed.
export default function SitterTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { height: 72, paddingBottom: 10, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 15, fontWeight: '600' },
        tabBarIconStyle: { display: 'none' },
        tabBarActiveTintColor: '#0B5CAD',
        tabBarInactiveTintColor: '#555555',
      }}
    >
      <Tabs.Screen name="sitter" options={{ title: 'Today', tabBarLabel: 'Today' }} />
      <Tabs.Screen name="sitter-week" options={{ title: 'My week', tabBarLabel: 'Week' }} />
      <Tabs.Screen
        name="my-availability"
        options={{ title: 'My availability', tabBarLabel: 'Hours' }}
      />
      <Tabs.Screen name="time-off" options={{ title: 'Time off', tabBarLabel: 'Time off' }} />
    </Tabs>
  );
}
