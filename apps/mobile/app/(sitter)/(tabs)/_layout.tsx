import { Tabs } from 'expo-router/js-tabs';

import { useBrand, useBrandedHeader } from '@/features/branding/brand';
import { useUnreadCount } from '@/features/chat/hooks';

// Big labels and a tall bar: sitters tap these one-handed.
export default function SitterTabsLayout() {
  const unread = useUnreadCount().data ?? 0;
  const header = useBrandedHeader();
  const { colors } = useBrand();
  return (
    <Tabs
      screenOptions={{
        ...header,
        tabBarStyle: { height: 72, paddingBottom: 10, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 15, fontWeight: '600' },
        tabBarIconStyle: { display: 'none' },
        tabBarActiveTintColor: colors.accentOnWhite,
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
      <Tabs.Screen
        name="sitter-messages"
        options={{
          title: 'Messages',
          tabBarLabel: 'Messages',
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarAccessibilityLabel: unread > 0 ? `Messages, ${unread} unread` : 'Messages',
        }}
      />
    </Tabs>
  );
}
