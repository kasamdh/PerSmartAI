import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MIN_TAP_TARGET } from '@/components/big-button';
import { EmptyView, ErrorView, LoadingView } from '@/components/query-states';
import { formatDayAndTime } from '@/features/visits/time';

import { useConversations } from './hooks';

/** Every conversation the user is part of (admins: every household), newest first. */
export function ConversationListScreen() {
  const router = useRouter();
  const conversations = useConversations();

  if (conversations.isPending) return <LoadingView label="Loading messages" />;
  if (conversations.isError) return <ErrorView onRetry={() => conversations.refetch()} />;

  const now = new Date();
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <FlashList
        data={conversations.data}
        keyExtractor={(c) => c.household_id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={conversations.isRefetching}
            onRefresh={() => void conversations.refetch()}
          />
        }
        ListEmptyComponent={
          <EmptyView
            title="No conversations"
            body="You can message a household while you have a visit there within 30 days."
          />
        }
        renderItem={({ item }) => {
          const preview = item.last_message_at
            ? `${item.last_sender_name?.split(' ')[0] ?? 'Someone'}: ${
                item.last_message_body?.trim() || (item.last_message_has_photo ? '📷 Photo' : '')
              }`
            : 'No messages yet';
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.household_name}${item.unread ? `, ${item.unread} unread` : ''}`}
              onPress={() =>
                router.push({
                  pathname: '/messages/[householdId]',
                  params: { householdId: item.household_id },
                })
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.text}>
                <View style={styles.titleRow}>
                  <Text
                    style={[styles.title, item.unread > 0 && styles.unreadTitle]}
                    numberOfLines={1}
                  >
                    {item.household_name}
                  </Text>
                  {item.last_message_at ? (
                    <Text style={styles.time}>{formatDayAndTime(item.last_message_at, now)}</Text>
                  ) : null}
                </View>
                {item.owner_name ? <Text style={styles.owner}>{item.owner_name}</Text> : null}
                <Text
                  style={[styles.preview, item.unread > 0 && styles.unreadPreview]}
                  numberOfLines={2}
                >
                  {preview}
                </Text>
              </View>
              {item.unread > 0 ? (
                <Text style={styles.badge} accessibilityElementsHidden>
                  {item.unread > 99 ? '99+' : item.unread}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, flexGrow: 1 },
  separator: { height: 10 },
  row: {
    minHeight: MIN_TAP_TARGET + 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
  unreadTitle: { fontWeight: '800' },
  time: { fontSize: 13, color: '#666666' },
  owner: { fontSize: 14, color: '#666666' },
  preview: { fontSize: 16, color: '#444444' },
  unreadPreview: { color: '#1A1A1A', fontWeight: '600' },
  badge: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    backgroundColor: '#C62828',
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
    overflow: 'hidden',
  },
});
