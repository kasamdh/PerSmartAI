import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/ui';
import { useBrandedHeader } from '@/features/branding/brand';
import { useUnreadCount } from '@/features/chat/hooks';

// The design system's tab bar: icon over label, big targets for one-handed use.
// Today is the home tab.
export default function SitterTabsLayout() {
  const unread = useUnreadCount().data ?? 0;
  const header = useBrandedHeader();
  return (
    <Tabs
      screenOptions={header}
      tabBar={(props) => (
        <TabBar
          {...props}
          icons={{
            sitter: 'home',
            'sitter-week': 'calendar',
            'my-availability': 'clock',
            'time-off': 'sun',
            'sitter-messages': 'chat',
          }}
        />
      )}
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
